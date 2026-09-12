import { requirePermission } from '../../../utils/auth'
import { createSidebarCard } from '../../../modules/sidebar/sidebar-card.service'

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'sidebar-cards.create')
  const body = await readBody(event)
  return createSidebarCard(body)
})
