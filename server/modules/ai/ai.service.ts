import { createError } from 'h3'
import { asc, desc, eq, gte, sql } from 'drizzle-orm'
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
  pricing: AiPricing
}

export interface AiPricing {
  inputMicrosPerMillion: number
  outputMicrosPerMillion: number
  cacheHitMicrosPerMillion: number
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
    defaultModel: row.defaultModel,
    pricing: {
      inputMicrosPerMillion: Number(row.inputPriceMicrosPerMillion ?? 0),
      outputMicrosPerMillion: Number(row.outputPriceMicrosPerMillion ?? 0),
      cacheHitMicrosPerMillion: Number(row.cacheHitPriceMicrosPerMillion ?? 0)
    }
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
  estimatedCostMicros?: number
  pricing?: AiPricing
}): Promise<void> {
  try {
    const { pricing, estimatedCostMicros, ...request } = entry
    await getDb().insert(aiRequests).values({
      ...request,
      cacheStatus: request.cacheStatus ?? 'MISS',
      cachedInputTokens: request.cachedInputTokens ?? null,
      savedTokens: request.savedTokens ?? null,
      estimatedCostMicros: estimatedCostMicros ?? estimateAiCostMicros(request.model, request.inputTokens, request.outputTokens, request.cachedInputTokens, pricing)
    })
  } catch {
    /* usage log failures never break the request */
  }
}

interface AiModelPricing {
  input: number
  output: number
  cacheHit?: number
}

/* USD per one million tokens. Unknown models intentionally report zero
   rather than inventing a price; operators can override this map with
   AI_MODEL_PRICING_JSON, e.g. {"my-model":{"input":1,"output":2}}. */
const DEFAULT_AI_PRICING: Record<string, AiModelPricing> = {
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  'gpt-4o': { input: 2.5, output: 10 },
  'claude-3-5-sonnet': { input: 3, output: 15 },
  'claude-3-5-sonnet-20241022': { input: 3, output: 15 }
}

function aiPricing(): Record<string, AiModelPricing> {
  const raw = process.env.AI_MODEL_PRICING_JSON?.trim()
  if (!raw) return DEFAULT_AI_PRICING
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const custom: Record<string, AiModelPricing> = { ...DEFAULT_AI_PRICING }
    for (const [model, value] of Object.entries(parsed)) {
      if (!value || typeof value !== 'object') continue
      const input = Number((value as { input?: unknown }).input)
      const output = Number((value as { output?: unknown }).output)
      if (Number.isFinite(input) && input >= 0 && Number.isFinite(output) && output >= 0) {
        const cacheHit = Number((value as { cacheHit?: unknown }).cacheHit)
        custom[model.toLowerCase()] = { input, output, ...(Number.isFinite(cacheHit) && cacheHit >= 0 ? { cacheHit } : {}) }
      }
    }
    return custom
  } catch {
    return DEFAULT_AI_PRICING
  }
}

export function estimateAiCostMicros(model: string, inputTokens: number | null, outputTokens: number | null, cachedInputTokens: number | null = 0, override?: AiPricing): number {
  cachedInputTokens = cachedInputTokens ?? 0
  if (override && (override.inputMicrosPerMillion > 0 || override.outputMicrosPerMillion > 0 || override.cacheHitMicrosPerMillion > 0)) {
    const cached = Math.min(Math.max(cachedInputTokens, 0), Math.max(inputTokens ?? 0, 0))
    const normal = Math.max((inputTokens ?? 0) - cached, 0)
    return Math.max(0, Math.round((normal * override.inputMicrosPerMillion + (outputTokens ?? 0) * override.outputMicrosPerMillion + cached * override.cacheHitMicrosPerMillion) / 1_000_000))
  }
  const normalized = model.trim().toLowerCase()
  const pricing = aiPricing()[normalized]
    ?? Object.entries(aiPricing()).find(([key]) => normalized.startsWith(`${key}-`))?.[1]
  if (!pricing) return 0
  const cached = Math.min(Math.max(cachedInputTokens, 0), Math.max(inputTokens ?? 0, 0))
  const normal = Math.max((inputTokens ?? 0) - cached, 0)
  return Math.max(0, Math.round((normal * pricing.input * 1_000_000 + (outputTokens ?? 0) * pricing.output * 1_000_000 + cached * (pricing.cacheHit ?? pricing.input) * 1_000_000) / 1_000_000))
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
      userId,
      pricing: provider.pricing
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
      userId,
      pricing: provider.pricing
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
  inputPricePerMillion: number
  outputPricePerMillion: number
  cacheHitPricePerMillion: number
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
    enabled: row.enabled,
    inputPricePerMillion: Number(row.inputPriceMicrosPerMillion ?? 0) / 1_000_000,
    outputPricePerMillion: Number(row.outputPriceMicrosPerMillion ?? 0) / 1_000_000,
    cacheHitPricePerMillion: Number(row.cacheHitPriceMicrosPerMillion ?? 0) / 1_000_000
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
  inputPricePerMillion: number
  outputPricePerMillion: number
  cacheHitPricePerMillion: number
}): Promise<AiProviderView> {
  const db = getDb()
  const values: typeof aiProviders.$inferInsert = {
    name: input.name,
    providerType: input.providerType,
    baseUrl: input.baseUrl.replace(/\/+$/, ''),
    defaultModel: input.defaultModel,
    enabled: input.enabled,
    inputPriceMicrosPerMillion: Math.round(input.inputPricePerMillion * 1_000_000),
    outputPriceMicrosPerMillion: Math.round(input.outputPricePerMillion * 1_000_000),
    cacheHitPriceMicrosPerMillion: Math.round(input.cacheHitPricePerMillion * 1_000_000)
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

export interface AiUsageReport {
  overview: {
    requests: number
    successful: number
    failed: number
    inputTokens: number
    outputTokens: number
    totalTokens: number
    cacheHits: number
    cacheHitRate: number
    savedTokens: number
    estimatedCostMicros: number
    averageLatencyMs: number
  }
  models: Array<{ model: string, requests: number, inputTokens: number, outputTokens: number, costMicros: number }>
  features: Array<{ feature: string, requests: number, costMicros: number }>
  daily: Array<{ date: string, requests: number, tokens: number, costMicros: number }>
}

/** Aggregated, content-free AI telemetry for the admin dashboard. */
export async function getAiUsageReport(days = 30): Promise<AiUsageReport> {
  const since = new Date(Date.now() - Math.min(Math.max(days, 1), 365) * 86_400_000)
  const db = getDb()
  const [summary] = await db.select({
    requests: sql<number>`count(*)`,
    successful: sql<number>`sum(case when ${aiRequests.status} = 'ok' then 1 else 0 end)`,
    failed: sql<number>`sum(case when ${aiRequests.status} <> 'ok' then 1 else 0 end)`,
    inputTokens: sql<number>`coalesce(sum(${aiRequests.inputTokens}), 0)`,
    outputTokens: sql<number>`coalesce(sum(${aiRequests.outputTokens}), 0)`,
    cacheHits: sql<number>`sum(case when ${aiRequests.cacheStatus} <> 'MISS' then 1 else 0 end)`,
    savedTokens: sql<number>`coalesce(sum(${aiRequests.savedTokens}), 0)`,
    estimatedCostMicros: sql<number>`coalesce(sum(${aiRequests.estimatedCostMicros}), 0)`,
    averageLatencyMs: sql<number>`coalesce(avg(${aiRequests.latencyMs}), 0)`
  }).from(aiRequests).where(gte(aiRequests.createdAt, since))

  const models = await db.select({
    model: aiRequests.model,
    requests: sql<number>`count(*)`,
    inputTokens: sql<number>`coalesce(sum(${aiRequests.inputTokens}), 0)`,
    outputTokens: sql<number>`coalesce(sum(${aiRequests.outputTokens}), 0)`,
    costMicros: sql<number>`coalesce(sum(${aiRequests.estimatedCostMicros}), 0)`
  }).from(aiRequests).where(gte(aiRequests.createdAt, since))
    .groupBy(aiRequests.model)
    .orderBy(desc(sql`count(*)`))
    .limit(20)

  const features = await db.select({
    feature: aiRequests.feature,
    requests: sql<number>`count(*)`,
    costMicros: sql<number>`coalesce(sum(${aiRequests.estimatedCostMicros}), 0)`
  }).from(aiRequests).where(gte(aiRequests.createdAt, since))
    .groupBy(aiRequests.feature)
    .orderBy(desc(sql`count(*)`))
    .limit(20)

  const dateExpr = sql`date_format(${aiRequests.createdAt}, '%Y-%m-%d')`
  const daily = await db.select({
    date: dateExpr,
    requests: sql<number>`count(*)`,
    tokens: sql<number>`coalesce(sum(coalesce(${aiRequests.inputTokens}, 0) + coalesce(${aiRequests.outputTokens}, 0)), 0)`,
    costMicros: sql<number>`coalesce(sum(${aiRequests.estimatedCostMicros}), 0)`
  }).from(aiRequests).where(gte(aiRequests.createdAt, since))
    .groupBy(dateExpr)
    .orderBy(asc(dateExpr))

  const requests = Number(summary?.requests ?? 0)
  const cacheHits = Number(summary?.cacheHits ?? 0)
  const inputTokens = Number(summary?.inputTokens ?? 0)
  const outputTokens = Number(summary?.outputTokens ?? 0)
  return {
    overview: {
      requests,
      successful: Number(summary?.successful ?? 0),
      failed: Number(summary?.failed ?? 0),
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens,
      cacheHits,
      cacheHitRate: requests > 0 ? Math.round((cacheHits / requests) * 100) : 0,
      savedTokens: Number(summary?.savedTokens ?? 0),
      estimatedCostMicros: Number(summary?.estimatedCostMicros ?? 0),
      averageLatencyMs: Math.round(Number(summary?.averageLatencyMs ?? 0))
    },
    models: models.map(row => ({
      model: row.model || 'unknown',
      requests: Number(row.requests),
      inputTokens: Number(row.inputTokens),
      outputTokens: Number(row.outputTokens),
      costMicros: Number(row.costMicros)
    })),
    features: features.map(row => ({ feature: row.feature, requests: Number(row.requests), costMicros: Number(row.costMicros) })),
    daily: daily.map(row => ({
      date: String(row.date),
      requests: Number(row.requests),
      tokens: Number(row.tokens),
      costMicros: Number(row.costMicros)
    }))
  }
}
