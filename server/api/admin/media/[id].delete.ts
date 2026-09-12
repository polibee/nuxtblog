import { requirePermission } from '../../../utils/auth'
import { deleteMediaItem } from '../../../modules/media/media.service'

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'media.delete')
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid id' })
  }
  await deleteMediaItem(id)
  return { removed: 1 }
})
