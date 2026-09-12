import { clearCollection, ensureSeeded, getCollection, importRow, listCollectionNames } from '../utils/db'
import { initCache } from '../utils/kv'
import { initStore, loadPersisted } from '../utils/store'
import { readCacheConfig, readDbConfig } from '../utils/runtimeConfig'

/**
 * Boot: initialize the SQL store (postgres/mysql/supabase) when
 * configured, load persisted rows into the serving collections and
 * connect Redis when configured. A configured database fails closed by
 * default; memory fallback is an explicit escape hatch for development.
 */
export default defineNitroPlugin(async () => {
  const db = await readDbConfig()
  if (db.driver !== 'memory') {
    try {
      const kind = await initStore(db)
      console.log('[storage] driver:', kind)
      const persisted = await loadPersisted()
      let rows = 0
      for (const { resource, items } of persisted) {
        clearCollection(resource)
        for (const row of items) {
          importRow(resource, row)
          rows++
        }
      }
      if (db.seedDemo) ensureSeeded()
      console.log('[storage] loaded', rows, 'persisted rows from', kind)
    } catch (e: unknown) {
      console.error('[storage] SQL init failed:', (e as Error).message)
      if (!db.allowMemoryFallback) throw e
      console.warn('[storage] continuing in memory mode because ALLOW_MEMORY_FALLBACK=true')
    }
  }

  const cache = await readCacheConfig()
  if (cache.driver === 'redis') {
    try {
      const kind = await initCache(cache)
      console.log('[cache] driver:', kind)
    } catch (e: unknown) {
      console.error('[cache] Redis init failed, continuing in memory mode:', (e as Error).message)
    }
  }

  // touch collections so lazy ct_* creation does not surprise the log
  for (const name of listCollectionNames()) getCollection(name)
})
