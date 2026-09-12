import { requirePermission } from '../../../utils/auth'
import { updateUser } from '../../../modules/users/user.service'

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'users.edit')
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid id' })
  }
  const body = await readBody(event)
  return updateUser(id, body)
})
