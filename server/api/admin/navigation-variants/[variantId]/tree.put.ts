import { requirePermission } from '../../../../utils/auth'
import { saveNavigationTree } from '../../../../modules/navigation/navigation.service'

/** PUT /api/admin/navigation-variants/:variantId/tree — transactional tree save */
export default defineEventHandler(async (event) => {
  await requirePermission(event, 'navigation.edit')
  const variantId = Number(getRouterParam(event, 'variantId'))
  if (!Number.isInteger(variantId) || variantId <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid variant id' })
  }
  const body = await readBody(event)
  await saveNavigationTree(variantId, body ?? {})
  return { ok: true }
})
