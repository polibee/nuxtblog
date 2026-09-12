import { readDbConfig, readCacheConfig } from '../../../utils/runtimeConfig'
import { testStoreConnection } from '../../../utils/store'
import { testCacheConnection } from '../../../utils/kv'
import { upsertSettingByKey } from '../../../utils/settingsStore'
import { requirePermission } from '../../../utils/auth'

interface TestBody {
  target?: 'database' | 'cache'
  /** optional overrides for testing values that are not saved yet */
  driver?: string
  url?: string
  host?: string
  port?: number
  database?: string
  user?: string
  password?: string
  ssl?: boolean
}

/**
 * POST /api/admin/database/test — probe connectivity for the database
 * driver or the Redis cache, using the posted overrides when present.
 */
export default defineEventHandler(async (event) => {
  await requirePermission(event, 'settings.edit')

  const body = await readBody<TestBody>(event)
  const target = body?.target ?? 'database'

  if (target === 'cache') {
    const base = await readCacheConfig()
    const result = await testCacheConnection({
      driver: (body?.driver as 'redis' | 'memory') ?? base.driver,
      url: body?.url ?? base.url,
      host: body?.host ?? base.host,
      port: Number(body?.port ?? base.port),
      password: body?.password || base.password,
      db: base.db
    })
    if (!result.ok) throw createError({ statusCode: 502, statusMessage: `Redis: ${result.error}` })
    return result
  }

  const current = await readDbConfig()
  const config = {
    ...current,
    driver: (body?.driver ?? current.driver) as typeof current.driver,
    url: body?.url ?? current.url,
    host: body?.host ?? current.host,
    port: Number(body?.port ?? current.port),
    database: body?.database ?? current.database,
    user: body?.user ?? current.user,
    hasPassword: true,
    ssl: body?.ssl ?? current.ssl
  }
  if (config.driver !== 'memory' && !config.url && !config.database) {
    throw createError({ statusCode: 422, statusMessage: 'A database name or connection URL is required' })
  }

  const result = await testStoreConnection(config)
  if (!result.ok) throw createError({ statusCode: 502, statusMessage: `${config.driver}: ${result.error}` })

  // persist the tested password so "Test, then Save" keeps a usable config
  if (typeof body?.password === 'string' && body.password) {
    await upsertSettingByKey('DB_PASSWORD', body.password)
  }
  return result
})
