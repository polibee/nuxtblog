import { requirePermission } from '../../../../utils/auth'
import { createNavigationVariant } from '../../../../modules/navigation/navigation.service'

/** POST /api/admin/navigations/:id/variants — create a locale variant (optionally copied) */
export default defineEventHandler(async (event) => {
  await requirePermission(event, 'navigation.edit')
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid id' })
  }
  const body = await readBody<{ localeCode?: string, copyFromVariantId?: number }>(event)
  return createNavigationVariant(id, body ?? {})
})
