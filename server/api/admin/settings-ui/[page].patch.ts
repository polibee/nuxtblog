import { requirePermission } from '../../../utils/auth'
import { saveSettingsPage } from '../../../modules/settings/ui.service'

/** PATCH /api/admin/settings-ui/:page — batch update (§8/46/47):
    one endpoint per page, never one per field. Server re-validates
    against the registry (§48). */
export default defineEventHandler(async (event) => {
  await requirePermission(event, 'settings.edit')
  const page = getRouterParam(event, 'page') ?? ''
  const body = await readBody(event) as { values?: Record<string, unknown> }
  return await saveSettingsPage(page, body?.values ?? {})
})
