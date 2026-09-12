import { asc, desc, eq } from 'drizzle-orm'
import { getDb } from '../../repositories/db.server'
import { aiConversations, aiMessages, aiToolCalls } from '../../repositories/schema/profile'
import { generateCompletion, logRequest, type AiProviderRuntime } from './ai.service'
import { resolveTool, toolDefinitions } from './tools'
import { withToolCache } from './optimization/tool-cache'
import { estimateTokens } from './optimization/token-budget'

/* P30 AI Assistant (docs/ai优化.txt §15-31) + P31 Optimization Layer
   (docs/AI缓存优化.txt) + P32 Workspace (docs/AI组件优化.txt C2):
   tool-calling chat over the READ-only site tool registry with
   tool-result caching, conversation compression, prefix-stable prompt
   layout, depth policy and attached context. v1: non-streaming,
   openai-compatible tool-call loop (anthropic = text-only without
   tools). Conversations are persisted; tool results are summarized by
   the model, never stored raw. */

/* §24: only the most recent messages travel raw; older turns are
   folded into a deterministic summary */
const SUMMARY_KEEP = 10

/* §21/22: depth really controls tool rounds + max tokens, not just a
   label */
const DEPTH_POLICY = {
  quick: { maxTokens: 1500, maxToolIterations: 2 },
  balanced: { maxTokens: 3000, maxToolIterations: 4 },
  deep: { maxTokens: 4000, maxToolIterations: 6 }
} as const

export type ChatDepth = keyof typeof DEPTH_POLICY

export interface ToolActivity {
  tool: string
  status: 'ok' | 'cache_hit' | 'error'
  durationMs: number
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  references?: Array<{ type: string, id: number, title: string }>
}

export async function getOrCreateConversation(userId: number | null, conversationId: number | null, scopeType: string, firstMessage: string): Promise<number> {
  const db = getDb()
  if (conversationId) {
    const [row] = await db.select({ id: aiConversations.id }).from(aiConversations).where(eq(aiConversations.id, conversationId)).limit(1)
    if (row) return row.id
  }
  /* §51: title = truncated first message — no extra model call */
  const [row] = await db.insert(aiConversations).values({
    userId: userId ?? undefined,
    title: firstMessage.slice(0, 80),
    scopeType
  })
  return row!.insertId
}

export async function getConversations(userId: number | null): Promise<Array<{ id: number, title: string, scopeType: string, updatedAt: Date }>> {
  const db = getDb()
  const columns = { id: aiConversations.id, title: aiConversations.title, scopeType: aiConversations.scopeType, updatedAt: aiConversations.updatedAt }
  if (userId) {
    return db.select(columns).from(aiConversations).where(eq(aiConversations.userId, userId)).orderBy(desc(aiConversations.updatedAt)).limit(50)
  }
  return db.select(columns).from(aiConversations).orderBy(desc(aiConversations.updatedAt)).limit(50)
}

export async function deleteConversation(userId: number | null, id: number): Promise<void> {
  const db = getDb()
  const [row] = await db.select({ id: aiConversations.id, userId: aiConversations.userId }).from(aiConversations).where(eq(aiConversations.id, id)).limit(1)
  if (!row) return
  if (userId && row.userId !== userId) return
  await db.delete(aiMessages).where(eq(aiMessages.conversationId, id))
  await db.delete(aiToolCalls).where(eq(aiToolCalls.conversationId, id))
  await db.delete(aiConversations).where(eq(aiConversations.id, id))
}

interface StoredMessage extends ChatMessage {
  id: number
}

export async function getConversationMessages(conversationId: number): Promise<ChatMessage[]> {
  return getDb()
    .select({ id: aiMessages.id, role: aiMessages.role, content: aiMessages.content, referencesJson: aiMessages.referencesJson })
    .from(aiMessages)
    .where(eq(aiMessages.conversationId, conversationId))
    .orderBy(asc(aiMessages.id))
    .then(rows => rows.map(r => ({
      id: r.id,
      role: r.role as 'user' | 'assistant',
      content: r.content,
      references: r.referencesJson ? JSON.parse(r.referencesJson) : undefined
    })))
}

export async function saveMessage(conversationId: number, role: string, content: string, references?: Array<{ type: string, id: number, title: string }>): Promise<void> {
  await getDb().insert(aiMessages).values({
    conversationId,
    role,
    content,
    referencesJson: references ? JSON.stringify(references) : null
  })
}

async function saveToolCall(conversationId: number, tool: string, status: string, durationMs: number): Promise<void> {
  await getDb().insert(aiToolCalls).values({ conversationId, tool, status, durationMs })
}

async function executeTool(conversationId: number, name: string, args: Record<string, unknown>): Promise<{ result: unknown, cacheHit: boolean, chars: number, durationMs: number }> {
  const tool = resolveTool(name)
  if (!tool) return { result: { error: 'unknown tool' }, cacheHit: false, chars: 0, durationMs: 0 }
  const started = Date.now()
  try {
    const { result, hit, chars } = await withToolCache(tool.name, args, () => tool.execute(args))
    const durationMs = Date.now() - started
    await saveToolCall(conversationId, tool.name, hit ? 'cache_hit' : 'ok', durationMs)
    return { result, cacheHit: hit, chars, durationMs }
  } catch (e) {
    const durationMs = Date.now() - started
    await saveToolCall(conversationId, tool.name, 'error', durationMs)
    return { result: { error: (e as Error).message }, cacheHit: false, chars: 0, durationMs }
  }
}

const SYSTEM_PROMPT = `You are the site assistant of a Nuxt blog CMS. You answer questions about the site's content, SEO, store, profile, media and comments by calling the provided tools. Rules:
- Always call tools to get real data before answering. Never invent numbers.
- Answer in the same language as the user's question.
- Be concise and specific. When you cite posts/pages, list their titles.
- You have READ-only access. If asked to modify something, explain what should be changed instead.`

interface OpenAiMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string | null
  tool_calls?: Array<{ id: string, type: 'function', function: { name: string, arguments: string } }>
  tool_call_id?: string
}

/* §24/25: fold older turns into a compact summary. Deterministic (0
   tokens) and persisted with the message id it covers so it stays
   byte-stable across turns (provider prefix-cache friendly). */
async function conversationContext(conversationId: number, history: StoredMessage[]): Promise<{ summary: string | null, recent: ChatMessage[] }> {
  if (history.length <= SUMMARY_KEEP) return { summary: null, recent: history }

  const keepFrom = history[history.length - SUMMARY_KEEP]!.id
  const [conv] = await getDb()
    .select({ summaryText: aiConversations.summaryText, summaryUntilMessageId: aiConversations.summaryUntilMessageId })
    .from(aiConversations).where(eq(aiConversations.id, conversationId)).limit(1)

  if (conv?.summaryUntilMessageId && conv.summaryText && conv.summaryUntilMessageId >= keepFrom) {
    return { summary: conv.summaryText, recent: history.filter(m => m.id > conv.summaryUntilMessageId!) }
  }

  const older = history.filter(m => m.id < keepFrom)
  const lines = older.map(m => `${m.role}: ${m.content.slice(0, 120).replace(/\s+/g, ' ')}`)
  const summary = `Summary of the earlier conversation (for context only):\n${lines.join('\n')}`
  await getDb().update(aiConversations)
    .set({ summaryText: summary, summaryUntilMessageId: keepFrom - 1 })
    .where(eq(aiConversations.id, conversationId))
  return { summary, recent: history.filter(m => m.id >= keepFrom) }
}

/* C2 attached context: cheap digests for explicitly attached entities,
   capped by the token budget (§12 pyramid: summaries before bodies) */
async function buildAttachedContextText(context: Array<{ type: string, id: number }>): Promise<string> {
  const parts: string[] = []
  for (const item of context.slice(0, 6)) {
    if (item.type === 'post') {
      const { getPostDigest } = await import('./optimization/digest')
      const digest = await getPostDigest(item.id)
      if (digest) {
        parts.push(`[Post #${item.id}] ${digest.title}\n${digest.summary}\nKeywords: ${digest.keywords.join(', ')}\nHeadings: ${digest.headings.join(' | ')}`)
      }
    } else if (item.type === 'page') {
      const { pages, pageTranslations } = await import('../../repositories/schema/pages')
      const [row] = await getDb()
        .select({ title: pageTranslations.title, content: pageTranslations.content })
        .from(pageTranslations)
        .innerJoin(pages, eq(pageTranslations.pageId, pages.id))
        .where(eq(pages.id, item.id))
        .limit(1)
      if (row) parts.push(`[Page #${item.id}] ${row.title}\n${(row.content ?? '').slice(0, 500)}`)
    } else if (item.type === 'product') {
      const { products, productTranslations } = await import('../../repositories/schema/products')
      const [row] = await getDb()
        .select({ title: productTranslations.title, description: productTranslations.description })
        .from(productTranslations)
        .innerJoin(products, eq(productTranslations.productId, products.id))
        .where(eq(products.id, item.id))
        .limit(1)
      if (row) parts.push(`[Product #${item.id}] ${row.title}\n${(row.description ?? '').slice(0, 400)}`)
    }
  }
  if (parts.length === 0) return ''
  let text = `Attached context selected by the user (summaries only):\n\n${parts.join('\n\n')}`
  const capped = estimateTokens(text) > 2000
  if (capped) text = text.slice(0, 8000)
  return text
}

export async function runAssistantTurn(input: {
  conversationId: number
  scopeType: string
  messages: ChatMessage[]
  provider: AiProviderRuntime
  depth?: ChatDepth
  attachedContext?: Array<{ type: string, id: number }>
  /* P33 preset composition (§48): instructions are injected server-side
     after the core policy — never sent from the client */
  presetInstructions?: string | null
  toolPrefixes?: string[] | null
}): Promise<{
  reply: string
  references: Array<{ type: string, id: number, title: string }>
  toolActivity: ToolActivity[]
  contextTokens: number
}> {
  const depth = input.depth ?? 'balanced'
  const policy = DEPTH_POLICY[depth]
  const { summary, recent } = await conversationContext(input.conversationId, input.messages as StoredMessage[])

  /* §15/16 prefix layout: STATIC system prompt first (byte-stable for
     provider prompt cache), dynamic scope/context appended after */
  const openaiMessages: OpenAiMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT }
  ]
  /* §50: preset instructions sit in the stable prefix after the core
     policy so provider prompt caches still hit per-preset */
  if (input.presetInstructions) {
    openaiMessages.push({ role: 'system', content: `Preset instructions:\n${input.presetInstructions}` })
  }
  if (summary) {
    openaiMessages.push({ role: 'system', content: summary })
  }
  /* C2 attached context: digests of explicitly attached entities */
  if (input.attachedContext && input.attachedContext.length > 0) {
    const contextText = await buildAttachedContextText(input.attachedContext)
    if (contextText) openaiMessages.push({ role: 'system', content: contextText })
  }
  const firstUserIndex = recent.findIndex(m => m.role === 'user')
  recent.forEach((m, i) => {
    let content = m.content
    if (i === firstUserIndex) content = `Current scope: ${input.scopeType}\n\n${content}`
    openaiMessages.push({ role: m.role, content } as OpenAiMessage)
  })

  const contextTokens = openaiMessages.reduce((sum, m) => sum + estimateTokens(m.content ?? ''), 0)

  const references: Array<{ type: string, id: number, title: string }> = []
  const toolActivity: ToolActivity[] = []
  let reply = ''
  let toolCacheChars = 0
  let toolCacheHits = 0
  let totalInput = 0
  let totalOutput = 0
  let totalLatency = 0
  const startedAt = Date.now()

  /* P36: analysis tier model from Settings → AI (provider default when unset) */
  const { resolveModel, modelClassForFeature } = await import('./optimization/model-router')
  const routedModel = await resolveModel(input.provider, modelClassForFeature('chat'))

  for (let iteration = 0; iteration < policy.maxToolIterations; iteration++) {
    const res = await generateCompletion(input.provider, openaiMessages as Array<{ role: 'system' | 'user' | 'assistant', content: string }>, {
      tools: toolDefinitions(input.toolPrefixes ?? null),
      maxTokens: policy.maxTokens,
      model: routedModel
    })
    totalInput += res.inputTokens ?? 0
    totalOutput += res.outputTokens ?? 0
    totalLatency += res.latencyMs

    if (res.toolCalls.length === 0) {
      reply = res.text
      break
    }

    openaiMessages.push({
      role: 'assistant',
      content: res.text || null,
      tool_calls: res.toolCalls.map(c => ({
        id: c.id,
        type: 'function' as const,
        function: { name: c.name, arguments: JSON.stringify(c.arguments) }
      }))
    })

    for (const call of res.toolCalls) {
      const tool = resolveTool(call.name)
      if (!tool) {
        toolActivity.push({ tool: call.name, status: 'error', durationMs: 0 })
        openaiMessages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify({ error: 'unknown tool' }) })
        continue
      }
      const { result, cacheHit, chars, durationMs } = await executeTool(input.conversationId, tool.name, call.arguments)
      toolActivity.push({ tool: tool.name, status: cacheHit ? 'cache_hit' : 'ok', durationMs })
      if (cacheHit) {
        toolCacheHits++
        toolCacheChars += chars
      }
      openaiMessages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(result ?? {}).slice(0, 6000) })
      /* extract references from known result shapes */
      if (tool.name === 'content.posts.list' || tool.name === 'content.search') {
        const list = Array.isArray(result) ? result as Array<{ id?: number, title?: string }> : []
        for (const item of list.slice(0, 5)) {
          if (item?.id && item?.title) references.push({ type: 'post', id: item.id, title: item.title })
        }
      }
    }
  }

  /* loop exhausted while the model kept requesting tools — force a
     text answer without tools */
  if (!reply) {
    openaiMessages.push({ role: 'user', content: 'Provide your final answer now based on the tool results collected above.' })
    const final = await generateCompletion(input.provider, openaiMessages as Array<{ role: 'system' | 'user' | 'assistant', content: string }>, { maxTokens: policy.maxTokens, model: routedModel })
    totalInput += final.inputTokens ?? 0
    totalOutput += final.outputTokens ?? 0
    totalLatency += final.latencyMs
    reply = final.text
  }

  if (!reply) reply = '（无回复）'

  /* real durations land in the ai_tool_calls audit rows; the activity
     array gets its durations from the same source on the next read —
     here we attach what we measured */
  try {
    await logRequest({
      feature: `chat.${depth}`,
      providerId: input.provider.id,
      model: routedModel,
      status: 'ok',
      inputTokens: totalInput || null,
      outputTokens: totalOutput || null,
      latencyMs: totalLatency || Date.now() - startedAt,
      errorCode: null,
      userId: null,
      cacheStatus: toolCacheHits > 0 ? 'TOOL_HIT' : 'MISS',
      savedTokens: toolCacheHits > 0 ? Math.ceil(toolCacheChars / 4) : 0
    })
  } catch { /* usage log failures never break the turn */ }

  /* one post may appear in multiple locales — dedupe by type+id */
  const seen = new Set<string>()
  const uniqueReferences = references.filter((r) => {
    const key = `${r.type}-${r.id}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
  return { reply, references: uniqueReferences, toolActivity, contextTokens }
}
