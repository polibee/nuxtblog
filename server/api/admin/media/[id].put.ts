import { requirePermission } from '../../../utils/auth'
import { updateMediaItem } from '../../../modules/media/media.service'

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'media.edit')
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid id' })
  }
  const body = await readBody(event)
  return updateMediaItem(id, body)
})
