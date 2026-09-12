import { createError } from 'h3'
import { desc, eq } from 'drizzle-orm'
import { decryptSecret, encryptSecret, maskSecret } from '../../utils/encryption'
import { getDb, isBlogDbReady } from '../../repositories/db.server'
import { aiProviders, aiRequests } from '../../repositories/schema/ai'
import { buildEditorPrompt } from './prompts'
import type { EditorAiInput } from '#shared/schemas/ai'

/* P28 AI Gateway (AI 集成文档 §70/113): provider registry + unified
   completion call + usage logging. OpenAI-compatible covers openai /
   openrouter / most custom endpoints; anthropic uses its messages API. */

export interface AiCompletionResult {
  text: string
  model: string
  inputTokens: number | null
  outputTokens: number | null
  latencyMs: number
  toolCalls: Array<{ id: string, name: string, arguments: Record<string, unknown> }>
}

export interface AiProviderRuntime {
  id: number
  name: string
  providerType: string
  baseUrl: string
  apiKey: string
  defaultModel: string
}

export async function getActiveProvider(): Promise<AiProviderRuntime | null> {
  if (!isBlogDbReady()) return null
  const [row] = await getDb().select().from(aiProviders).where(eq(aiProviders.enabled, true)).limit(1)
  if (!row?.apiKeyEncrypted) return null
  let apiKey: string
  try {
    apiKey = decryptSecret(JSON.parse(row.apiKeyEncrypted) as { ciphertext: string, nonce: string, authTag: string })
  } catch {
    return null
  }
  return {
    id: row.id,
    name: row.name,
    providerType: row.providerType,
    baseUrl: row.baseUrl.replace(/\/+$/, ''),
    apiKey,
    defaultModel: row.defaultModel
  }
}

export async function generateCompletion(
  provider: AiProviderRuntime,
  messages: Array<{ role: 'system' | 'user' | 'assistant', content: string }>,
  options: {
    model?: string
    maxTokens?: number
    temperature?: number
    tools?: Array<{ type: 'function', function: { name: string, description: string, parameters: object } }>
  } = {}
): Promise<AiCompletionResult> {
  const model = options.model || provider.defaultModel
  const startedAt = Date.now()

  let text: string
  let inputTokens: number | null
  let outputTokens: number | null
  let toolCalls: AiCompletionResult['toolCalls']

  if (provider.providerType === 'anthropic') {
    const res = await $fetch<{ content: Array<{ text?: string }>, usage?: { input_tokens?: number, output_tokens?: number } }>(
      `${provider.baseUrl}/v1/messages`,
      {
        method: 'POST',
        headers: {
          'x-api-key': provider.apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json'
        },
        body: {
          model,
          max_tokens: options.maxTokens ?? 2048,
          temperature: options.temperature ?? 0.7,
          system: messages.find(m => m.role === 'system')?.content,
          messages: messages.filter(m => m.role !== 'system')
        }
      }
    )
    text = (res.content ?? []).map(c => c.text ?? '').join('')
    inputTokens = res.usage?.input_tokens ?? null
    outputTokens = res.usage?.output_tokens ?? null
    toolCalls = []
  } else {
    /* openai + openai_compatible share the chat/completions shape */
    const res = await $fetch<{
      choices: Array<{ message?: { content?: string, tool_calls?: Array<{ id: string, type: string, function: { name: string, arguments: string } }> } }>
      usage?: { prompt_tokens?: number, completion_tokens?: number }
    }>(
      `${provider.baseUrl}/chat/completions`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${provider.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: {
          model,
          messages,
          max_tokens: options.maxTokens ?? 2048,
          temperature: options.temperature ?? 0.7,
          ...(options.tools ? { tools: options.tools } : {})
        }
      }
    )
    text = res.choices?.[0]?.message?.content ?? ''
    inputTokens = res.usage?.prompt_tokens ?? null
    outputTokens = res.usage?.completion_tokens ?? null
    toolCalls = (res.choices?.[0]?.message?.tool_calls ?? []).map(tc => ({
      id: tc.id,
      name: tc.function?.name ?? '',
      arguments: safeParseArgs(tc.function?.arguments)
    }))
  }

  return { text: text.trim(), model, inputTokens, outputTokens, toolCalls, latencyMs: Date.now() - startedAt }
}

function safeParseArgs(raw: string | undefined): Record<string, unknown> {
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw)
    return typeof parsed === 'object' && parsed !== null ? parsed as Record<string, unknown> : {}
  } catch {
    return {}
  }
}

function mapProviderError(status: number, message: string): { code: string, status: number } {
  if (status === 401 || status === 403) return { code: 'AI_AUTH_FAILED', status: 502 }
  if (status === 429) return { code: 'AI_RATE_LIMITED', status: 429 }
  if (status === 408 || message.includes('timeout')) return { code: 'AI_TIMEOUT', status: 504 }
  if (status >= 500) return { code: 'AI_PROVIDER_ERROR', status: 502 }
  return { code: 'AI_PROVIDER_ERROR', status: 502 }
}

export async function logRequest(entry: {
  feature: string
  providerId: number | null
  model: string
  status: string
  inputTokens: number | null
  outputTokens: number | null
  latencyMs: number
  errorCode: string | null
  userId: number | null
  cacheStatus?: string
  cachedInputTokens?: number | null
  savedTokens?: number | null
}): Promise<void> {
  try {
    await getDb().insert(aiRequests).values({
      ...entry,
      cacheStatus: entry.cacheStatus ?? 'MISS',
      cachedInputTokens: entry.cachedInputTokens ?? null,
      savedTokens: entry.savedTokens ?? null
    })
  } catch {
    /* usage log failures never break the request */
  }
}

/* ---------------- editor AI (A2, §5-14) ---------------- */

export async function runEditorFeature(input: EditorAiInput, userId: number | null): Promise<AiCompletionResult> {
  if (!isBlogDbReady()) {
    throw createError({ statusCode: 503, statusMessage: 'Database unavailable', data: { code: 'AI_PROVIDER_ERROR' } })
  }
  const provider = await getActiveProvider()
  if (!provider) {
    throw createError({ statusCode: 503, statusMessage: 'No AI provider configured', data: { code: 'AI_PROVIDER_NOT_CONFIGURED' } })
  }

  const messages = buildEditorPrompt(input)
  try {
    /* P36: model per quality tier (Settings → AI), falls back to the
       provider default when the tier is unset */
    const { resolveModel, modelClassForFeature } = await import('./optimization/model-router')
    const model = await resolveModel(provider, modelClassForFeature(`editor.${input.feature}`))
    const result = await generateCompletion(provider, [
      { role: 'system', content: messages.system },
      { role: 'user', content: messages.user }
    ], { maxTokens: 2048, model })
    await logRequest({
      feature: `editor.${input.feature}`,
      providerId: provider.id,
      model: result.model,
      status: 'ok',
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      latencyMs: result.latencyMs,
      errorCode: null,
      userId
    })
    if (!result.text) {
      throw createError({ statusCode: 502, statusMessage: 'Empty AI response', data: { code: 'AI_INVALID_RESPONSE' } })
    }
    return result
  } catch (e: unknown) {
    const err = e as Error & { statusCode?: number, data?: { code?: string } }
    const mapped = err.data?.code
      ? { code: err.data.code, status: err.statusCode ?? 502 }
      : mapProviderError(err.statusCode ?? 0, err.message ?? '')
    await logRequest({
      feature: `editor.${input.feature}`,
      providerId: provider.id,
      model: provider.defaultModel,
      status: 'error',
      inputTokens: null,
      outputTokens: null,
      latencyMs: 0,
      errorCode: mapped.code,
      userId
    })
    throw createError({
      statusCode: mapped.status,
      statusMessage: mapped.code,
      data: { code: mapped.code }
    })
  }
}

/* ---------------- provider settings (admin) ---------------- */

export interface AiProviderView {
  id: number
  name: string
  providerType: string
  baseUrl: string
  apiKeyHint: string
  hasKey: boolean
  defaultModel: string
  enabled: boolean
}

export async function listAiProviders(): Promise<AiProviderView[]> {
  const rows = await getDb().select().from(aiProviders).orderBy(desc(aiProviders.id))
  return rows.map(row => ({
    id: row.id,
    name: row.name,
    providerType: row.providerType,
    baseUrl: row.baseUrl,
    apiKeyHint: row.apiKeyHint,
    hasKey: Boolean(row.apiKeyEncrypted),
    defaultModel: row.defaultModel,
    enabled: row.enabled
  }))
}

export async function upsertAiProvider(input: {
  id?: number
  name: string
  providerType: string
  baseUrl: string
  apiKey?: string
  defaultModel: string
  enabled: boolean
}): Promise<AiProviderView> {
  const db = getDb()
  const values: typeof aiProviders.$inferInsert = {
    name: input.name,
    providerType: input.providerType,
    baseUrl: input.baseUrl.replace(/\/+$/, ''),
    defaultModel: input.defaultModel,
    enabled: input.enabled
  }
  if (input.apiKey) {
    values.apiKeyEncrypted = JSON.stringify(encryptSecret(input.apiKey))
    values.apiKeyHint = maskSecret(input.apiKey)
  }

  if (input.id) {
    const [existing] = await db.select({ hasKey: aiProviders.apiKeyEncrypted })
      .from(aiProviders).where(eq(aiProviders.id, input.id)).limit(1)
    if (!existing) throw createError({ statusCode: 404, statusMessage: 'Provider not found' })
    if (!input.apiKey && !existing.hasKey) {
      throw createError({ statusCode: 422, statusMessage: 'API key is required' })
    }
    await db.update(aiProviders).set(values).where(eq(aiProviders.id, input.id))
  } else {
    if (!input.apiKey) {
      throw createError({ statusCode: 422, statusMessage: 'API key is required' })
    }
    await db.insert(aiProviders).values(values)
  }
  const list = await listAiProviders()
  return list[list.length - 1]!
}

export async function testAiProvider(): Promise<{ ok: true, latencyMs: number, model: string }> {
  const provider = await getActiveProvider()
  if (!provider) {
    throw createError({ statusCode: 503, statusMessage: 'No AI provider configured', data: { code: 'AI_PROVIDER_NOT_CONFIGURED' } })
  }
  const result = await generateCompletion(provider, [
    { role: 'user', content: 'Reply with the single word: ok' }
  ], { maxTokens: 10 })
  return { ok: true, latencyMs: result.latencyMs, model: result.model }
}

export async function recentAiRequests(limit = 20): Promise<Array<Record<string, unknown>>> {
  return getDb()
    .select()
    .from(aiRequests)
    .orderBy(desc(aiRequests.id))
    .limit(Math.min(limit, 100))
}
