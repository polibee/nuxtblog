import { requirePermission } from '../../../../utils/auth'
import { resetSettingsFields } from '../../../../modules/settings/ui.service'

/** POST /api/admin/settings-ui/:page/reset — delete DB overrides so the
    schema defaults shine through again (§59/67). */
export default defineEventHandler(async (event) => {
  await requirePermission(event, 'settings.edit')
  const page = getRouterParam(event, 'page') ?? ''
  const body = await readBody(event) as { keys?: string[] }
  const keys = Array.isArray(body?.keys) ? body.keys.map(String).slice(0, 50) : []
  return await resetSettingsFields(page, keys)
})
