import { requirePermission } from '../../../utils/auth'
import { previewBackup } from '../../../modules/backup/backup.service'

/** POST /api/admin/backup/preview — parse an uploaded backup ZIP and
    return the manifest for review before restore (§14). */
export default defineEventHandler(async (event) => {
  await requirePermission(event, 'backup.edit')
  const parts = await readMultipartFormData(event)
  const file = parts?.find(p => p.name === 'file')
  if (!file) {
    throw createError({ statusCode: 422, statusMessage: 'Multipart field "file" is required' })
  }
  try {
    return await previewBackup(file.data)
  } catch (e) {
    throw createError({ statusCode: 422, statusMessage: (e as Error).message })
  }
})
