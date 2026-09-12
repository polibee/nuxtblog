import { uploadMediaFile } from '../../../modules/media/media.service'

const MAX_SIZE = 10 * 1024 * 1024

/** POST /api/public/advertising/upload — ad material banner upload.
    Image-only (the media service enforces the magic-byte whitelist);
    the asset is classified usage_type=advertising. */
export default defineEventHandler(async (event) => {
  const parts = await readMultipartFormData(event)
  const file = parts?.find(p => p.name === 'file')
  if (!file) {
    throw createError({ statusCode: 422, statusMessage: 'Multipart field "file" is required' })
  }
  if (file.data.length > MAX_SIZE) {
    throw createError({ statusCode: 413, statusMessage: 'File exceeds the 10MB limit' })
  }
  const created = await uploadMediaFile({
    filename: file.filename,
    type: file.type,
    data: file.data
  }, { usageType: 'advertising' })
  return { id: created.id, url: created.url }
})
