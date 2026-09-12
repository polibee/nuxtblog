import { isSafeStorageKey } from '../../modules/media/media.service'
import { findMediaByStorageKey, findVariantByStorageKey } from '../../repositories/media.runtime.repository'
import { isBlogDbReady } from '../../repositories/db.server'

/**
 * GET /media/:key — public media file delivery. The key is generated
 * server-side (timestamp-uuid, validated before lookup) so there is
 * no path traversal surface; metadata comes from the media table.
 * Variant renditions (thumbnail/medium/large) resolve through
 * media_variants and always serve webp.
 */
export default defineEventHandler(async (event) => {
  const key = getRouterParam(event, 'key') ?? ''
  if (!isSafeStorageKey(key)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid media key' })
  }
  if (!isBlogDbReady()) {
    throw createError({ statusCode: 503, statusMessage: 'Database unavailable' })
  }

  const original = await findMediaByStorageKey(key)
  let mime = original?.mime
  if (!original) {
    const variant = await findVariantByStorageKey(key)
    if (!variant) {
      throw createError({ statusCode: 404, statusMessage: 'Media not found' })
    }
    mime = `image/${variant.format}`
  }
  if (!mime) mime = 'application/octet-stream'
  const data = await useStorage('media').getItemRaw(key)
  if (!data) {
    throw createError({ statusCode: 404, statusMessage: 'File missing from storage' })
  }

  setResponseHeader(event, 'Content-Type', mime)
  setResponseHeader(event, 'Cache-Control', 'public, max-age=31536000, immutable')
  return data
})
