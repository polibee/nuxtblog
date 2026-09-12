import { requirePermission } from '../../../utils/auth'
import { createPage } from '../../../modules/pages/page.service'

export default defineEventHandler(async (event) => {
  const current = await requirePermission(event, 'pages.create')
  const body = await readBody(event)
  return createPage(body, current.id)
})
