import { and, eq, gt, isNull, or } from 'drizzle-orm'
import { getDb, isBlogDbReady } from '../../../repositories/db.server'
import { aiToolCache } from '../../../repositories/schema/ai'
import { getVersionMap, versionSignature, type AiDomain } from './domain-versions'
import { singleFlight } from './single-flight'
import { sha256 } from './fingerprint'

/* P31 Tool Result Cache (缓存优化 §8/9/37): tool results are keyed on
   tool + normalized args + the domain versions the tool reads — a post
   edit invalidates post tools without touching profile tools. TTL is a
   safety net for missed invalidation events. */

const TOOL_TTL_MS = 10 * 60 * 1000

/* which domains each tool reads (§32: minimal invalidation surface) */
export const TOOL_DOMAINS: Record<string, AiDomain[]> = {
  'site.overview': ['posts', 'pages', 'profile', 'taxonomy', 'comments', 'products', 'media'],
  'content.posts.list': ['posts'],
  'content.posts.get': ['posts'],
  'content.posts.digest': ['posts'],
  'content.search': ['posts'],
  'pages.list': ['pages'],
  'seo.summary': ['posts', 'pages'],
  'profile.get': ['profile'],
  'taxonomy.list': ['taxonomy'],
  'comments.summary': ['comments'],
  'store.summary': ['products'],
  'media.summary': ['media']
}

export interface ToolCacheEntry<T = unknown> {
  result: T
  chars: number
}

export async function toolCacheKey(toolName: string, args: Record<string, unknown>): Promise<string | null> {
  if (!isBlogDbReady()) return null
  const domains = TOOL_DOMAINS[toolName]
  if (!domains) return null
  const versions = await getVersionMap()
  const sorted: Record<string, unknown> = {}
  for (const k of Object.keys(args).sort()) sorted[k] = args[k]
  const normalized = JSON.stringify(sorted, (_k, v) => (v === undefined ? null : v))
  return sha256(`${toolName}:${normalized}:${versionSignature(versions, domains)}`)
}

export async function getToolResult<T>(key: string): Promise<ToolCacheEntry<T> | null> {
  const rows = await getDb()
    .select({ payloadJson: aiToolCache.payloadJson })
    .from(aiToolCache)
    .where(and(
      eq(aiToolCache.cacheKey, key),
      or(isNull(aiToolCache.expiresAt), gt(aiToolCache.expiresAt, new Date()))
    ))
    .limit(1)
  if (!rows[0]) return null
  try {
    return { result: JSON.parse(rows[0].payloadJson) as T, chars: rows[0].payloadJson.length }
  } catch {
    return null
  }
}

export async function putToolResult(key: string, toolName: string, result: unknown): Promise<number> {
  const payload = JSON.stringify(result ?? null)
  const chars = payload.length
  try {
    await getDb()
      .insert(aiToolCache)
      .values({
        cacheKey: key,
        toolName,
        payloadJson: payload,
        payloadChars: chars,
        expiresAt: new Date(Date.now() + TOOL_TTL_MS)
      })
      .onDuplicateKeyUpdate({
        set: { payloadJson: payload, payloadChars: chars, createdAt: new Date(), expiresAt: new Date(Date.now() + TOOL_TTL_MS) }
      })
  } catch (e) {
    console.error('[ai-cache] tool cache put failed:', (e as Error).message)
  }
  return chars
}

/** cached tool execution with single-flight (§48) */
export async function withToolCache<T>(toolName: string, args: Record<string, unknown>, execute: () => Promise<T>): Promise<{ result: T, hit: boolean, chars: number }> {
  const key = await toolCacheKey(toolName, args)
  if (!key) {
    const result = await execute()
    return { result, hit: false, chars: JSON.stringify(result ?? null).length }
  }
  const cached = await getToolResult<T>(key)
  if (cached) return { result: cached.result, hit: true, chars: cached.chars }
  const { result, chars } = await singleFlight(`tool:${key}`, async () => {
    const r = await execute()
    const c = await putToolResult(key, toolName, r)
    return { result: r, chars: c }
  })
  return { result, hit: false, chars }
}
