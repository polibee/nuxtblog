import { requirePermission } from '../../../utils/auth'
import { updateNavigationMeta } from '../../../modules/navigation/navigation.service'

/** PUT /api/admin/navigations/:id — update admin name / enabled */
export default defineEventHandler(async (event) => {
  await requirePermission(event, 'navigation.edit')
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid id' })
  }
  const body = await readBody<{ adminName?: string, enabled?: boolean }>(event)
  await updateNavigationMeta(id, body ?? {})
  return { ok: true }
})
