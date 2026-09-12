import { requirePermission } from '../../../utils/auth'
import { getUser } from '../../../modules/users/user.service'

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'users.view')
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid id' })
  }
  return getUser(id)
})
