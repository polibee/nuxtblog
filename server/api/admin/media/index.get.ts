import { requirePermission } from '../../../utils/auth'
import { listMediaItemsForAdmin } from '../../../modules/media/media.service'

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'media.view')
  const query = getQuery(event) as {
    q?: string
    page?: number
    perPage?: number
    sortBy?: string
    sortDir?: string
    folderId?: number
    usageType?: string
    used?: string
    missingAlt?: string
  }
  const normalized = {
    ...query,
    folderId: query.folderId !== undefined ? Number(query.folderId) : undefined,
    used: query.used === 'true' ? true : query.used === 'false' ? false : undefined,
    missingAlt: query.missingAlt === 'true' ? true : undefined
  }
  return listMediaItemsForAdmin(normalized)
})
