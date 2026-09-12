import { requirePermission } from '../../../utils/auth'
import { listPageItems } from '../../../modules/pages/page.service'

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'pages.view')
  const query = getQuery(event) as {
    q?: string
    status?: string
    page?: number
    perPage?: number
    sortBy?: string
    sortDir?: string
  }
  return listPageItems(query)
})
