import { requirePermission } from '../../../../utils/auth'
import { getMediaItem } from '../../../../modules/media/media.service'

/** GET /api/admin/media/:id/raw — permission-gated byte stream */
export default defineEventHandler(async (event) => {
  await requirePermission(event, 'media.view')
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid id' })
  }

  const row = await getMediaItem(id)
  const data = await useStorage('media').getItemRaw(row.storageKey)
  if (!data) {
    throw createError({ statusCode: 404, statusMessage: 'File missing from storage' })
  }
  setResponseHeader(event, 'Content-Type', row.mime)
  setResponseHeader(event, 'Cache-Control', 'private, max-age=3600')
  return data
})
