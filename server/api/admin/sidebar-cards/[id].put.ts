import { requirePermission } from '../../../utils/auth'
import { updateSidebarCard } from '../../../modules/sidebar/sidebar-card.service'

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'sidebar-cards.edit')
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid id' })
  }
  const body = await readBody(event)
  return updateSidebarCard(id, body)
})
