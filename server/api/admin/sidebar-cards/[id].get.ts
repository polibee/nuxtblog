import { requirePermission } from '../../../utils/auth'
import { getSidebarCard } from '../../../modules/sidebar/sidebar-card.service'

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'sidebar-cards.view')
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid id' })
  }
  return getSidebarCard(id)
})
