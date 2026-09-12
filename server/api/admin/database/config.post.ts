import type { DbDriver } from '../../../utils/runtimeConfig'
import { readDbConfig } from '../../../utils/runtimeConfig'
import { upsertSettingByKey } from '../../../utils/settingsStore'
import { invalidatePageCache } from '../../../utils/pageCache'
import { requirePermission } from '../../../utils/auth'

interface ConfigBody {
  driver?: string
  url?: string
  host?: string
  port?: number
  database?: string
  user?: string
  password?: string
  ssl?: boolean
  seedDemo?: boolean
}

/**
 * POST /api/admin/database/config — persist driver configuration.
 * Takes effect on the next server restart (the boot plugin reads it).
 * Empty password = keep the stored one.
 */
export default defineEventHandler(async (event) => {
  await requirePermission(event, 'settings.edit')

  const body = await readBody<ConfigBody>(event)
  if (!body) {
    throw createError({ statusCode: 422, statusMessage: 'Invalid request body' })
  }
  const current = await readDbConfig()
  const driver = (body.driver ?? current.driver) as DbDriver
  if (!['memory', 'postgres', 'mysql', 'supabase'].includes(driver)) {
    throw createError({ statusCode: 422, statusMessage: '"driver" must be memory, postgres, mysql or supabase' })
  }
  const port = Number(body.port ?? current.port)
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw createError({ statusCode: 422, statusMessage: '"port" must be a valid port number' })
  }

  const values: Array<[string, string | number | boolean]> = [
    ['DB_DRIVER', driver],
    ['DB_HOST', String(body.host ?? current.host)],
    ['DB_PORT', port],
    ['DB_NAME', String(body.database ?? current.database)],
    ['DB_USER', String(body.user ?? current.user)],
    ['DB_SSL', Boolean(body.ssl ?? current.ssl)],
    ['SEED_DEMO', Boolean(body.seedDemo ?? current.seedDemo)]
  ]
  // secrets: empty means keep; url wins over discrete fields when provided
  if (typeof body.url === 'string' && body.url.trim()) values.push(['DATABASE_URL', body.url.trim()])
  if (typeof body.password === 'string' && body.password) values.push(['DB_PASSWORD', body.password])

  for (const [key, value] of values) {
    await upsertSettingByKey(key, value)
  }

  await invalidatePageCache(['public-settings'])
  return { ok: true, restartRequired: driver !== 'memory' || current.driver !== 'memory' }
})
