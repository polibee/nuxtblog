import { requirePermission } from '../../../utils/auth'
import { updatePage } from '../../../modules/pages/page.service'

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'pages.edit')
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid id' })
  }
  const body = await readBody(event)
  return updatePage(id, body)
})
