import { requirePermission } from '../../../utils/auth'
import { getPageItem } from '../../../modules/pages/page.service'

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'pages.view')
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid id' })
  }
  return getPageItem(id)
})
