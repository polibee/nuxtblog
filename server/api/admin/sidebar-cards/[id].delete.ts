import { requirePermission } from '../../../utils/auth'
import { deleteSidebarCard } from '../../../modules/sidebar/sidebar-card.service'

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'sidebar-cards.delete')
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid id' })
  }
  await deleteSidebarCard(id)
  return { removed: 1 }
})
