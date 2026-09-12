import { requirePermission } from '../../../utils/auth'
import { resolveSettingsPage } from '../../../modules/settings/ui.service'

/** GET /api/admin/settings-ui/:page — resolved values + schema
    metadata for one settings page (设置.txt §70 half-dynamic). */
export default defineEventHandler(async (event) => {
  await requirePermission(event, 'settings.view')
  const page = getRouterParam(event, 'page') ?? ''
  return await resolveSettingsPage(page)
})
