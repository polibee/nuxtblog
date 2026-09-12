import { createError } from 'h3'
import { createHash } from 'node:crypto'
import { MEDIA_USAGE_TYPES, mediaUpdateSchema, MAX_MEDIA_SIZE, type MediaUpdateInput } from '#shared/schemas/media'
import { isDomainDbReady } from '../../repositories/domain-status'
import {
  deleteMediaRow,
  findMediaIdByHash,
  findVariantStorageKeys,
  getMedia,
  insertMedia,
  insertMediaVariants,
  listMedia,
  listVariantsForMedia,
  updateMediaRow,
  type MediaRecord,
  type MediaTranslationRow,
  type MediaVariantRow
} from '../../repositories/media.runtime.repository'
import { listLocales } from '../../repositories/locale.runtime.repository'
import { withCodeKeyedTranslations, withCodeKeyedTranslationsAll } from '../../utils/translations'
import { imageSizeFromBuffer } from '../../utils/imageSize'
import { generateImageVariants } from './image-variants'
import { findMediaReferences } from './media-reference.runtime.service'

/* Media domain service (P03). Bytes go to useStorage('media') with a
   random storage key; the DB row is the metadata index. alt/caption
   translations are replaced as a group in one transaction. */

export type { MediaRecord }

export function sanitizeMediaFilename(name: string): string {
  const withoutControlChars = Array.from(name)
    .filter(ch => ch.charCodeAt(0) > 31)
    .join('')
  const base = withoutControlChars
    .replace(/[\\/]+/g, '-')
    .replace(/[<>:"|?*]+/g, '')
    .trim()
    .slice(0, 255)
  if (!base || /^[.-]+$/.test(base)) return 'file'
  return base
}

export function makeStorageKey(): string {
  return `${Date.now()}-${crypto.randomUUID()}`
}

/* upload whitelist (P14 hardening): images (magic-byte verified) + PDF.
   SVG is excluded - same-origin <script> inside SVG is a stored-XSS vector. */
const ALLOWED_MIME = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'application/pdf'])

function detectImageMime(data: Buffer): string | null {
  if (data.length >= 4 && data.subarray(0, 4).toString('hex') === '89504e47') return 'image/png'
  if (data.length >= 3 && data.subarray(0, 3).toString('hex') === 'ffd8ff') return 'image/jpeg'
  if (data.length >= 3 && data.subarray(0, 3).toString('ascii') === 'GIF') return 'image/gif'
  if (data.length >= 12 && data.subarray(0, 4).toString('ascii') === 'RIFF' && data.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp'
  return null
}

function validateUploadMime(declared: string | undefined, data: Buffer): void {
  const mime = (declared ?? '').split(';')[0]?.trim().toLowerCase() ?? ''
  if (!ALLOWED_MIME.has(mime)) {
    throw createError({ statusCode: 415, statusMessage: `Unsupported file type: ${mime || 'unknown'}. Allowed: PNG, JPEG, GIF, WebP, PDF.` })
  }
  if (mime.startsWith('image/')) {
    const sniffed = detectImageMime(data)
    if (sniffed !== mime) {
      throw createError({ statusCode: 415, statusMessage: 'File content does not match its image type' })
    }
  }
}

export interface UploadContext {
  usageType?: string
  folderId?: number | null
}

export async function uploadMediaFile(
  file: {
    filename?: string
    type?: string
    data: Buffer
  },
  context: UploadContext = {}
): Promise<MediaRecord & { duplicateOf: number | null }> {
  if (!isDomainDbReady()) {
    throw createError({ statusCode: 503, statusMessage: 'Database unavailable' })
  }
  if (file.data.length === 0) {
    throw createError({ statusCode: 422, statusMessage: 'Empty file' })
  }
  if (file.data.length > MAX_MEDIA_SIZE) {
    throw createError({ statusCode: 413, statusMessage: 'File exceeds the 10MB limit' })
  }
  validateUploadMime(file.type, file.data)

  const usageType = MEDIA_USAGE_TYPES.includes(context.usageType as typeof MEDIA_USAGE_TYPES[number])
    ? context.usageType!
    : 'general'

  const storageKey = makeStorageKey()
  await useStorage('media').setItemRaw(storageKey, file.data)
  const dimensions = file.type?.startsWith('image/')
    ? imageSizeFromBuffer(file.data)
    : null
  try {
    const hash = createHash('sha256').update(file.data).digest('hex')
    const duplicateOf = await findMediaIdByHash(hash)
    const id = await insertMedia({
      storageKey,
      filename: sanitizeMediaFilename(file.filename ?? storageKey),
      mime: file.type && file.type.includes('/') ? file.type : 'application/octet-stream',
      size: file.data.length,
      width: dimensions?.width ?? null,
      height: dimensions?.height ?? null,
      usageType,
      hash
    }, [])
    /* base renditions (thumbnail/medium/large webp); originals stay intact */
    if (file.type?.startsWith('image/')) {
      const variants = await generateImageVariants(file.data)
      await insertMediaVariants(variants.map(v => ({
        mediaId: id,
        variant: v.variant,
        storageKey: v.storageKey,
        width: v.width,
        height: v.height,
        size: v.size,
        format: v.format
      } satisfies MediaVariantRow)))
    }
    const created = await getMedia(id)
    if (!created) throw createError({ statusCode: 500, statusMessage: 'Media disappeared after upload' })
    return { ...created, duplicateOf }
  } catch (e: unknown) {
    /* keep storage consistent: no DB row means no orphan bytes */
    await useStorage('media').removeItem(storageKey).catch(() => undefined)
    throw e
  }
}

export async function getMediaItem(id: number): Promise<MediaRecord & { variants: Array<MediaVariantRow & { url: string }> }> {
  const item = await getMedia(id)
  if (!item) {
    throw createError({ statusCode: 404, statusMessage: `Media #${id} not found` })
  }
  const variantMap = await listVariantsForMedia([id])
  const withCodes = await withCodeKeyedTranslations(item)
  return {
    ...withCodes,
    variants: variantMap.get(id) ?? []
  }
}

export async function listMediaItemsForAdmin(query: Parameters<typeof listMedia>[0]): Promise<{
  items: MediaRecord[]
  total: number
  page: number
  perPage: number
  totalPages: number
}> {
  const result = await listMedia(query)
  const items = await withCodeKeyedTranslationsAll(result.items)
  const variantMap = await listVariantsForMedia(result.items.map(i => i.id))
  return {
    ...result,
    items: items.map(item => ({ ...item, variants: variantMap.get(item.id) ?? [] }))
  }
}

export async function updateMediaItem(id: number, body: unknown): Promise<MediaRecord> {
  const existing = await getMedia(id)
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: `Media #${id} not found` })
  }
  const result = mediaUpdateSchema.safeParse(body)
  if (!result.success) {
    throw createError({
      statusCode: 422,
      statusMessage: result.error.issues[0]?.message ?? 'Invalid input'
    })
  }
  const input: MediaUpdateInput = result.data

  let translations: MediaTranslationRow[] | undefined
  if (input.translations) {
    const locales = await listLocales()
    const codeToId = new Map(locales.map(l => [l.code, l.id]))
    translations = []
    for (const [code, fields] of Object.entries(input.translations)) {
      const localeId = codeToId.get(code)
      if (!localeId) {
        throw createError({ statusCode: 422, statusMessage: `Unknown locale "${code}"` })
      }
      translations.push({
        localeId,
        alt: String(fields.alt ?? ''),
        caption: String(fields.caption ?? '')
      })
    }
  }

  await updateMediaRow(
    id,
    {
      ...(input.filename ? { filename: sanitizeMediaFilename(input.filename) } : {}),
      ...(input.folderId !== undefined ? { folderId: input.folderId } : {}),
      ...(input.usageType !== undefined ? { usageType: input.usageType } : {})
    },
    translations
  )
  const updated = await getMedia(id)
  if (!updated) throw createError({ statusCode: 500, statusMessage: 'Media disappeared after update' })
  return withCodeKeyedTranslations(updated)
}

export async function deleteMediaItem(id: number): Promise<void> {
  /* delete guard (media.txt SS35-36): refuse while any module references it */
  const references = await findMediaReferences(id)
  if (references.length > 0) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Media is in use',
      data: { references }
    })
  }
  const variantKeys = await findVariantStorageKeys(id)
  const storageKey = await deleteMediaRow(id)
  if (!storageKey) {
    throw createError({ statusCode: 404, statusMessage: `Media #${id} not found` })
  }
  await useStorage('media').removeItem(storageKey).catch(() => undefined)
  for (const key of variantKeys) {
    await useStorage('media').removeItem(key).catch(() => undefined)
  }
}

export async function getMediaReferences(id: number) {
  const item = await getMedia(id)
  if (!item) {
    throw createError({ statusCode: 404, statusMessage: `Media #${id} not found` })
  }
  return findMediaReferences(id)
}

/** validate a storage key before serving bytes on the public route */
export function isSafeStorageKey(key: string): boolean {
  return /^[0-9]{13}-[0-9a-f-]{36}$/.test(key)
}
