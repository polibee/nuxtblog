import { onCmsEvent } from './events'
import { getKV } from './kv'
import { getSettingValue } from '../modules/settings/settings.runtime.service'

/* =============================================================
 * Page cache - the WP Super Cache of this framework.
 *
 * Caches the public GET surfaces that anonymous visitors and search
 * engines consume: sitemap.xml, rss.xml and /api/public-settings.
 * Bodies live in the KV layer (memory, or Redis when configured -
 * which makes the cache shared across instances). Metrics are
 * process-local.
 *
 * Invalidation is event-driven: any content lifecycle event purges
 * the content-tagged keys; settings writes purge public-settings.
 * ============================================================= */

const DEFAULT_TTL: Record<string, number> = {
  'sitemap': 300,
  'rss': 300,
  'public-settings': 600
}

interface CacheEntry {
  body: string
  genMs: number
  createdAt: number
}

interface KeyStat {
  hits: number
  misses: number
}

const metrics = {
  hits: 0,
  misses: 0,
  invalidations: 0,
  savedMs: 0
}

const perKey = new Map<string, KeyStat>()
const cachedKeys = new Set<string>()

export async function pageCacheEnabled(): Promise<boolean> {
  if (process.env.PAGE_CACHE_ENABLED === 'false') return false
  const value = await getSettingValue('PAGE_CACHE_ENABLED', 'true')
  return String(value) !== 'false'
}

function statFor(key: string): KeyStat {
  let stat = perKey.get(key)
  if (!stat) {
    stat = { hits: 0, misses: 0 }
    perKey.set(key, stat)
  }
  return stat
}

export interface PageCacheResult {
  body: string
  hit: boolean
}

/** get-or-set wrapper for public GET surfaces */
export async function withPageCache(
  key: string,
  produce: () => Promise<string>,
  opts?: { ttlSec?: number }
): Promise<PageCacheResult> {
  if (!(await pageCacheEnabled())) {
    const body = await produce()
    return { body, hit: false }
  }

  const entry = (await getKV().get('page:' + key)) as CacheEntry | null
  if (entry) {
    const stat = statFor(key)
    stat.hits++
    metrics.hits++
    metrics.savedMs += entry.genMs
    return { body: entry.body, hit: true }
  }

  const stat = statFor(key)
  stat.misses++
  metrics.misses++

  const started = Date.now()
  const body = await produce()
  const genMs = Date.now() - started

  const entryToStore: CacheEntry = { body, genMs, createdAt: Date.now() }
  const ttl = opts?.ttlSec ?? DEFAULT_TTL[key] ?? 300
  await getKV().set('page:' + key, entryToStore, ttl)
  cachedKeys.add(key)

  return { body, hit: false }
}

/** purge specific keys, or every cached page when keys are omitted */
export async function invalidatePageCache(keys?: string[]): Promise<number> {
  const targets = keys ?? [...cachedKeys]
  for (const key of targets) {
    await getKV().del('page:' + key)
    cachedKeys.delete(key)
  }
  metrics.invalidations += targets.length
  return targets.length
}

export interface CacheStats {
  enabled: boolean
  driver: string
  hits: number
  misses: number
  hitRate: number
  savedMs: number
  invalidations: number
  entries: number
  keys: Array<{ key: string, hits: number, misses: number }>
}

export async function cacheStatsSnapshot(): Promise<CacheStats> {
  const total = metrics.hits + metrics.misses
  return {
    enabled: await pageCacheEnabled(),
    driver: getKV().kind,
    hits: metrics.hits,
    misses: metrics.misses,
    hitRate: total === 0 ? 0 : Math.round((metrics.hits / total) * 100),
    savedMs: metrics.savedMs,
    invalidations: metrics.invalidations,
    entries: cachedKeys.size,
    keys: [...perKey.entries()]
      .map(([key, stat]) => ({ key, ...stat }))
      .sort((a, b) => b.hits - a.hits)
  }
}

/* ---- event-driven invalidation (self-registered) ---- */

const CONTENT_EVENTS = [
  'content.afterCreate',
  'content.afterUpdate',
  'content.afterDelete',
  'content.published',
  'content.unpublished',
  'content.restored'
]

for (const evt of CONTENT_EVENTS) {
  onCmsEvent(evt, (payload) => {
    const resource = String((payload as { resource?: string })?.resource ?? '')
    if (resource === 'settings' || resource === 'database' || resource === 'mail') {
      invalidatePageCache(['public-settings'])
      return
    }
    // content-ish resources affect sitemap + feed
    invalidatePageCache(['sitemap', 'rss'])
  })
}
