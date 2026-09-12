import { requirePermission } from '../../../utils/auth'
import { deleteNavigationVariant } from '../../../modules/navigation/navigation.service'
import { findVariantById } from '../../../repositories/navigation.repository'
import { invalidateAllNavigationCaches } from '../../../utils/navigationCache'

/** DELETE /api/admin/navigation-variants/:variantId */
export default defineEventHandler(async (event) => {
  await requirePermission(event, 'navigation.delete')
  const variantId = Number(getRouterParam(event, 'variantId'))
  if (!Number.isInteger(variantId) || variantId <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid variant id' })
  }
  const variant = await findVariantById(variantId)
  if (!variant) {
    throw createError({ statusCode: 404, statusMessage: `Variant #${variantId} not found` })
  }
  await deleteNavigationVariant(variantId)
  await invalidateAllNavigationCaches()
  return { removed: 1 }
})
