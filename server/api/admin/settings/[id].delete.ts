import { requirePermission } from '../../../utils/auth'
import { deleteSetting } from '../../../modules/settings/settings.service'

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'settings.delete')
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid id' })
  }
  await deleteSetting(id)
  return { removed: 1 }
})
