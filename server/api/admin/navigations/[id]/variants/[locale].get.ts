import { requirePermission } from '../../../../../utils/auth'
import { getNavigationVariantTree } from '../../../../../modules/navigation/navigation.service'

/** GET /api/admin/navigations/:id/variants/:locale — variant tree for the editor */
export default defineEventHandler(async (event) => {
  await requirePermission(event, 'navigation.view')
  const id = Number(getRouterParam(event, 'id'))
  const locale = String(getRouterParam(event, 'locale') ?? '')
  if (!Number.isInteger(id) || id <= 0 || !locale) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid id or locale' })
  }
  const tree = await getNavigationVariantTree(id, locale)
  if (!tree) {
    throw createError({ statusCode: 404, statusMessage: `No ${locale} variant for navigation #${id}` })
  }
  return tree
})
