import { requirePermission } from '../../../utils/auth'
import { createUser } from '../../../modules/users/user.service'

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'users.create')
  const body = await readBody(event)
  return createUser(body)
})
