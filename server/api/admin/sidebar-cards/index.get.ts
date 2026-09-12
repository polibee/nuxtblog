import { requirePermission } from '../../../utils/auth'
import { listSidebarCards } from '../../../modules/sidebar/sidebar-card.service'

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'sidebar-cards.view')
  const query = getQuery(event) as { q?: string, page?: number, perPage?: number }
  return listSidebarCards(query)
})
