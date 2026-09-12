import { requirePermission } from '../../../../utils/auth'
import { getMediaReferences } from '../../../../modules/media/media.service'

/** GET /api/admin/media/:id/references — "Used by" list (media.txt §34) */
export default defineEventHandler(async (event) => {
  await requirePermission(event, 'media.view')
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid id' })
  }
  return { references: await getMediaReferences(id) }
})
