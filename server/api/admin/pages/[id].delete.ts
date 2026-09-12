import { requirePermission } from '../../../utils/auth'
import { deletePage } from '../../../modules/pages/page.service'

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'pages.delete')
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid id' })
  }
  await deletePage(id)
  return { removed: 1 }
})
