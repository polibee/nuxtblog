import { requirePermission } from '../../../utils/auth'
import { deleteNavigationRow } from '../../../repositories/navigation.repository'
import { invalidateAllNavigationCaches } from '../../../utils/navigationCache'

/** DELETE /api/admin/navigations/:id — removes the location and its variants */
export default defineEventHandler(async (event) => {
  await requirePermission(event, 'navigation.delete')
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid id' })
  }
  await deleteNavigationRow(id)
  await invalidateAllNavigationCaches()
  return { removed: 1 }
})
