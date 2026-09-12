import { requirePermission } from '../../../utils/auth'
import { listUsers } from '../../../modules/users/user.service'

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'users.view')
  const query = getQuery(event) as {
    q?: string
    page?: number
    perPage?: number
    sortBy?: string
    sortDir?: string
  }
  return listUsers(query)
})
