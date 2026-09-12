import { describe, expect, it } from 'vitest'
import {
  cacheStatsSnapshot,
  invalidatePageCache,
  withPageCache
} from '../../server/utils/pageCache'

describe('pageCache (WP Super Cache style)', () => {
  it('caches a produced body: first call misses, second hits', async () => {
    let produced = 0
    const produce = async () => {
      produced++
      return `<sitemap>${produced}</sitemap>`
    }

    const first = await withPageCache('test:sitemap', produce)
    const second = await withPageCache('test:sitemap', produce)

    expect(first.hit).toBe(false)
    expect(second.hit).toBe(true)
    expect(second.body).toBe(first.body)
    expect(produced).toBe(1) // producer ran once
  })

  it('invalidation forces a re-produce', async () => {
    let version = 1
    await withPageCache('test:rss', async () => `rss v${version}`)
    await invalidatePageCache(['test:rss'])
    version = 2
    const after = await withPageCache('test:rss', async () => `rss v${version}`)
    expect(after.body).toBe('rss v2')
    expect(after.hit).toBe(false)
  })

  it('records hit/miss metrics per key', async () => {
    await withPageCache('test:metrics', async () => 'x')
    await withPageCache('test:metrics', async () => 'x')
    await withPageCache('test:metrics', async () => 'x') // 1 miss + 2 hits

    const stats = await cacheStatsSnapshot()
    const key = stats.keys.find(k => k.key === 'test:metrics')
    expect(key).toBeDefined()
    expect(key!.hits).toBeGreaterThanOrEqual(2)
    expect(key!.misses).toBeGreaterThanOrEqual(1)
    expect(stats.hitRate).toBeGreaterThanOrEqual(0)
    expect(stats.hitRate).toBeLessThanOrEqual(100)
  })

  it('respects the disabled switch (producer always runs)', () => {
    // env wins over the DB-backed PAGE_CACHE_ENABLED setting
    process.env.PAGE_CACHE_ENABLED = 'false'
    return (async () => {
      try {
        let produced = 0
        const produce = async () => {
          produced++
          return 'fresh'
        }
        await withPageCache('test:disabled', produce)
        await withPageCache('test:disabled', produce)
        expect(produced).toBe(2) // no caching when disabled
      } finally {
        delete process.env.PAGE_CACHE_ENABLED
      }
    })()
  })
})
