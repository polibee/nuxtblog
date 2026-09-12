import { requirePermission } from '../../../utils/auth'
import { findNavigationRow } from '../../../modules/navigation/navigation.service'

/** GET /api/admin/navigations/:id — one navigation with variants */
export default defineEventHandler(async (event) => {
  await requirePermission(event, 'navigation.view')
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid id' })
  }
  const navigation = await findNavigationRow(id)
  if (!navigation) {
    throw createError({ statusCode: 404, statusMessage: `Navigation #${id} not found` })
  }
  return navigation
})
