import { activeStoreKind } from '../../../utils/store'
import { readDbConfig } from '../../../utils/runtimeConfig'
import { requirePermission } from '../../../utils/auth'

/** GET /api/admin/database/config — current driver config (password never echoed) */
export default defineEventHandler(async (event) => {
  await requirePermission(event, 'settings.edit')
  const config = await readDbConfig()
  return {
    driver: config.driver,
    hasUrl: config.url.length > 0,
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.user,
    hasPassword: config.hasPassword,
    ssl: config.ssl,
    seedDemo: config.seedDemo,
    activeKind: activeStoreKind()
  }
})
