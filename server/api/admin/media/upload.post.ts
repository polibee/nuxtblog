import { requirePermission } from '../../../utils/auth'
import { uploadMediaFile } from '../../../modules/media/media.service'

const MAX_SIZE = 10 * 1024 * 1024 // 10MB

/** POST /api/admin/media/upload — multipart upload (field "file";
    optional "usageType" and "folderId" auto-classify the asset) */
export default defineEventHandler(async (event) => {
  await requirePermission(event, 'media.create')

  const parts = await readMultipartFormData(event)
  const file = parts?.find(p => p.name === 'file')
  if (!file) {
    throw createError({ statusCode: 422, statusMessage: 'Multipart field "file" is required' })
  }
  if (file.data.length > MAX_SIZE) {
    throw createError({ statusCode: 413, statusMessage: 'File exceeds the 10MB limit' })
  }

  const usageTypePart = parts?.find(p => p.name === 'usageType')
  const folderIdPart = parts?.find(p => p.name === 'folderId')
  const folderId = folderIdPart?.data.toString('utf-8')
    ? Number(folderIdPart.data.toString('utf-8'))
    : undefined

  return uploadMediaFile({
    filename: file.filename,
    type: file.type,
    data: file.data
  }, {
    usageType: usageTypePart?.data.toString('utf-8') || undefined,
    folderId: Number.isInteger(folderId) && folderId! > 0 ? folderId : undefined
  })
})
