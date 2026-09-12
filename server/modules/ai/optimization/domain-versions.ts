import { sql } from 'drizzle-orm'
import { getDb, isBlogDbReady } from '../../../repositories/db.server'
import { aiDomainVersions } from '../../../repositories/schema/ai'

/* P31 Domain Version Counters (缓存优化 §10/31/32): cheap event-driven
   invalidation. Content write services bump the domains they touch;
   cache keys embed the version map so stale entries miss naturally.
   §32: comment writes must NOT invalidate posts/seo/profile. */

export type AiDomain
  = | 'posts'
    | 'pages'
    | 'profile'
    | 'taxonomy'
    | 'comments'
    | 'products'
    | 'media'

/* short-lived in-memory cache of the version map — the map only changes
   when a write bumps it, and single-instance dev/admin usage makes a
   5s staleness window safe */
let cachedMap: { versions: Record<string, number>, at: number } | null = null
const MAP_TTL_MS = 5000

export async function getVersionMap(): Promise<Record<string, number>> {
  if (cachedMap && Date.now() - cachedMap.at < MAP_TTL_MS) return cachedMap.versions
  if (!isBlogDbReady()) return {}
  try {
    const rows = await getDb().select({ domain: aiDomainVersions.domain, version: aiDomainVersions.version }).from(aiDomainVersions)
    const versions: Record<string, number> = {}
    for (const row of rows) versions[row.domain] = row.version
    cachedMap = { versions, at: Date.now() }
    return versions
  } catch {
    return {}
  }
}

export async function bumpDomains(domains: AiDomain[]): Promise<void> {
  if (domains.length === 0 || !isBlogDbReady()) return
  cachedMap = null
  try {
    for (const domain of new Set(domains)) {
      await getDb()
        .insert(aiDomainVersions)
        .values({ domain, version: 1 })
        .onDuplicateKeyUpdate({ set: { version: sql`${aiDomainVersions.version} + 1` } })
    }
  } catch (e) {
    console.error('[ai-cache] domain bump failed:', (e as Error).message)
  }
}

export function versionSignature(versions: Record<string, number>, domains: AiDomain[]): string {
  return domains.map(d => `${d}:${versions[d] ?? 0}`).join('|')
}
