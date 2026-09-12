import { requirePermission, requireUser } from '../../../utils/auth'
import { deleteUser } from '../../../modules/users/user.service'

export default defineEventHandler(async (event) => {
  const current = await requireUser(event)
  await requirePermission(event, 'users.delete')
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid id' })
  }
  await deleteUser(id, current.id)
  return { removed: 1 }
})
