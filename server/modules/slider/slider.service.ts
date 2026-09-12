import { createError } from 'h3'
import type { PublicSlider, SliderInput, SliderItemInput } from '#shared/schemas/slider'
import { sliderInputSchema, sliderItemInputSchema } from '#shared/schemas/slider'
import { isBlogDbReady } from '../../repositories/db.server'
import { listLocales } from '../../repositories/locale.repository'
import { getKV } from '../../utils/kv'
import {
  deleteSliderItemRow,
  deleteSliderRow,
  findSlider,
  findSliderByKey,
  findSliderItem,
  insertSlider,
  insertSliderItem,
  listSliders,
  listSliderItems,
  listTranslationsForItems,
  mediaUrlFor,
  reorderSliderItems,
  replaceItemTranslations,
  updateSliderItemRow,
  updateSliderRow,
  type SliderItemRow,
  type SliderRow
} from '../../repositories/slider.repository'

/* Slider module (P19): admin CRUD for carousels + slides, public
   resolve endpoint. Public payloads are cached per key+locale in the
   KV layer (memory or Redis); every admin write invalidates the
   slider's cache keys. */

const CACHE_TTL = 600

interface LocaleMaps {
  codeToId: Map<string, number>
  defaultId: number
  codes: string[]
}

async function localeMaps(): Promise<LocaleMaps> {
  const locales = await listLocales()
  const defaultLocale = locales.find(l => l.isDefault) ?? locales[0]
  return {
    codeToId: new Map(locales.map(l => [l.code, l.id])),
    defaultId: defaultLocale?.id ?? 1,
    codes: locales.map(l => l.code)
  }
}

async function invalidateSliderCache(key: string): Promise<void> {
  const kv = getKV()
  await kv.del(`slider:${key}`).catch(() => undefined)
  const locales = await listLocales().catch(() => [])
  for (const locale of locales) {
    await kv.del(`slider:${key}:${locale.code}`).catch(() => undefined)
  }
}

function parseSliderInput(body: unknown): SliderInput {
  const result = sliderInputSchema.safeParse(body)
  if (!result.success) {
    throw createError({ statusCode: 422, statusMessage: result.error.issues[0]?.message ?? 'Invalid input' })
  }
  return result.data
}

function parseItemInput(body: unknown): SliderItemInput {
  const result = sliderItemInputSchema.safeParse(body)
  if (!result.success) {
    throw createError({ statusCode: 422, statusMessage: result.error.issues[0]?.message ?? 'Invalid input' })
  }
  return result.data
}

function toDate(value: string | null | undefined): Date | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

/* ---------------- admin: sliders ---------------- */

export interface AdminSlider extends SliderRow {
  itemCount: number
}

export async function listAdminSliders(): Promise<AdminSlider[]> {
  const rows = await listSliders()
  return Promise.all(rows.map(async row => ({
    ...row,
    itemCount: (await listSliderItems(row.id)).length
  })))
}

export async function createSlider(body: unknown): Promise<AdminSlider> {
  if (!isBlogDbReady()) throw createError({ statusCode: 503, statusMessage: 'Database unavailable' })
  const input = parseSliderInput(body)
  if (await findSliderByKey(input.key)) {
    throw createError({ statusCode: 409, statusMessage: `Slider key "${input.key}" already exists` })
  }
  const id = await insertSlider({ ...input })
  return { ...(await findSlider(id))!, itemCount: 0 }
}

export async function getAdminSlider(id: number): Promise<AdminSlider> {
  const row = await findSlider(id)
  if (!row) throw createError({ statusCode: 404, statusMessage: `Slider #${id} not found` })
  return { ...row, itemCount: (await listSliderItems(row.id)).length }
}

export async function updateSlider(id: number, body: unknown): Promise<AdminSlider> {
  const existing = await findSlider(id)
  if (!existing) throw createError({ statusCode: 404, statusMessage: `Slider #${id} not found` })
  const input = parseSliderInput(body)
  if (input.key !== existing.key && await findSliderByKey(input.key)) {
    throw createError({ statusCode: 409, statusMessage: `Slider key "${input.key}" already exists` })
  }
  await updateSliderRow(id, { ...input })
  await invalidateSliderCache(existing.key)
  await invalidateSliderCache(input.key)
  return { ...(await findSlider(id))!, itemCount: (await listSliderItems(id)).length }
}

export async function deleteSlider(id: number): Promise<void> {
  const existing = await findSlider(id)
  if (!existing) throw createError({ statusCode: 404, statusMessage: `Slider #${id} not found` })
  await deleteSliderRow(id)
  await invalidateSliderCache(existing.key)
}

/* ---------------- admin: items ---------------- */

export interface AdminSliderItem extends SliderItemRow {
  translations: Record<string, {
    title: string | null
    description: string | null
    buttonText: string | null
    linkUrl: string | null
    altText: string
  }>
  imageUrl: string | null
  mobileImageUrl: string | null
}

async function withTranslations(item: SliderItemRow): Promise<AdminSliderItem> {
  const [maps, rows] = await Promise.all([
    localeMaps(),
    listTranslationsForItems([item.id])
  ])
  const idToCode = new Map([...maps.codeToId.entries()].map(([code, id]) => [id, code]))
  const translations: AdminSliderItem['translations'] = {}
  for (const row of rows) {
    const code = idToCode.get(row.localeId)
    if (code) {
      translations[code] = {
        title: row.title,
        description: row.description,
        buttonText: row.buttonText,
        linkUrl: row.linkUrl,
        altText: row.altText
      }
    }
  }
  const [imageUrl, mobileImageUrl] = await Promise.all([
    mediaUrlFor(item.imageMediaId),
    mediaUrlFor(item.mobileImageMediaId)
  ])
  return { ...item, translations, imageUrl, mobileImageUrl }
}

export async function listAdminSliderItems(sliderId: number): Promise<AdminSliderItem[]> {
  const slider = await findSlider(sliderId)
  if (!slider) throw createError({ statusCode: 404, statusMessage: `Slider #${sliderId} not found` })
  const items = await listSliderItems(sliderId)
  return Promise.all(items.map(item => withTranslations(item)))
}

export async function createSliderItem(sliderId: number, body: unknown): Promise<AdminSliderItem> {
  const slider = await findSlider(sliderId)
  if (!slider) throw createError({ statusCode: 404, statusMessage: `Slider #${sliderId} not found` })
  const input = parseItemInput(body)
  const id = await insertSliderItem({
    sliderId,
    imageMediaId: input.imageMediaId,
    mobileImageMediaId: input.mobileImageMediaId ?? null,
    linkUrl: input.linkUrl || null,
    linkTarget: input.linkTarget ?? 'self',
    enabled: input.enabled ?? true,
    startsAt: toDate(input.startsAt),
    endsAt: toDate(input.endsAt),
    sortOrder: input.sortOrder ?? (await listSliderItems(sliderId)).length
  })
  await saveItemTranslations(id, input)
  await invalidateSliderCache(slider.key)
  return withTranslations((await findSliderItem(id))!)
}

export async function updateSliderItem(sliderId: number, itemId: number, body: unknown): Promise<AdminSliderItem> {
  const existing = await findSliderItem(itemId)
  if (!existing || existing.sliderId !== sliderId) {
    throw createError({ statusCode: 404, statusMessage: `Slider item #${itemId} not found` })
  }
  const slider = await findSlider(sliderId)
  const input = parseItemInput(body)
  await updateSliderItemRow(itemId, {
    imageMediaId: input.imageMediaId,
    mobileImageMediaId: input.mobileImageMediaId ?? null,
    linkUrl: input.linkUrl || null,
    linkTarget: input.linkTarget ?? 'self',
    enabled: input.enabled ?? true,
    startsAt: toDate(input.startsAt),
    endsAt: toDate(input.endsAt),
    ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {})
  })
  await saveItemTranslations(itemId, input)
  if (slider) await invalidateSliderCache(slider.key)
  return withTranslations((await findSliderItem(itemId))!)
}

async function saveItemTranslations(itemId: number, input: SliderItemInput): Promise<void> {
  if (!input.translations) return
  const maps = await localeMaps()
  const rows = Object.entries(input.translations).map(([code, fields]) => {
    const localeId = maps.codeToId.get(code)
    if (!localeId) {
      throw createError({ statusCode: 422, statusMessage: `Unknown locale "${code}"` })
    }
    return {
      sliderItemId: itemId,
      localeId,
      title: fields.title || null,
      description: fields.description || null,
      buttonText: fields.buttonText || null,
      linkUrl: fields.linkUrl || null,
      altText: fields.altText ?? ''
    }
  })
  await replaceItemTranslations(itemId, rows)
}

export async function deleteSliderItem(sliderId: number, itemId: number): Promise<void> {
  const existing = await findSliderItem(itemId)
  if (!existing || existing.sliderId !== sliderId) {
    throw createError({ statusCode: 404, statusMessage: `Slider item #${itemId} not found` })
  }
  const slider = await findSlider(sliderId)
  await deleteSliderItemRow(itemId)
  if (slider) await invalidateSliderCache(slider.key)
}

export async function reorderSlider(sliderId: number, ids: number[]): Promise<void> {
  const slider = await findSlider(sliderId)
  if (!slider) throw createError({ statusCode: 404, statusMessage: `Slider #${sliderId} not found` })
  await reorderSliderItems(sliderId, ids)
  await invalidateSliderCache(slider.key)
}

/* ---------------- public resolve ---------------- */

/** runtime status: enabled flag + time window, no stored status column */
export function sliderItemStatus(item: {
  enabled: boolean
  startsAt: Date | null
  endsAt: Date | null
}): 'active' | 'scheduled' | 'expired' | 'disabled' {
  if (!item.enabled) return 'disabled'
  const now = Date.now()
  if (item.startsAt && item.startsAt.getTime() > now) return 'scheduled'
  if (item.endsAt && item.endsAt.getTime() < now) return 'expired'
  return 'active'
}

export async function resolvePublicSlider(key: string, localeCode: string): Promise<PublicSlider> {
  if (!isBlogDbReady()) return { key, config: null, items: [] }
  const cacheKey = `slider:${key}:${localeCode}`
  const kv = getKV()
  const cached = await kv.get(cacheKey).catch(() => null)
  if (cached) return cached as PublicSlider

  const slider = await findSliderByKey(key)
  if (!slider || !slider.enabled) {
    const payload: PublicSlider = { key, config: null, items: [] }
    await kv.set(cacheKey, payload, CACHE_TTL).catch(() => undefined)
    return payload
  }

  const maps = await localeMaps()
  const localeId = maps.codeToId.get(localeCode) ?? maps.defaultId
  const items = (await listSliderItems(slider.id))
    .filter(item => sliderItemStatus(item) === 'active')

  const translations = await listTranslationsForItems(items.map(i => i.id))
  const byItem = new Map<number, typeof translations>()
  for (const row of translations) {
    const list = byItem.get(row.sliderItemId) ?? []
    list.push(row)
    byItem.set(row.sliderItemId, list)
  }

  const resolved = await Promise.all(items.map(async (item) => {
    const rows = byItem.get(item.id) ?? []
    /* strict requested locale, else default locale, else no copy */
    const translation = rows.find(r => r.localeId === localeId)
      ?? rows.find(r => r.localeId === maps.defaultId)
    const [image, mobileImage] = await Promise.all([
      mediaUrlFor(item.imageMediaId),
      mediaUrlFor(item.mobileImageMediaId)
    ])
    return {
      id: item.id,
      image: image ?? '',
      mobileImage,
      alt: translation?.altText || translation?.title || '',
      title: translation?.title ?? null,
      description: translation?.description ?? null,
      buttonText: translation?.buttonText ?? null,
      url: translation?.linkUrl || item.linkUrl,
      target: (item.linkTarget === 'blank' ? 'blank' : 'self') as 'self' | 'blank'
    }
  }))

  const payload: PublicSlider = {
    key,
    config: {
      autoplay: slider.autoplay,
      interval: slider.intervalMs,
      transition: slider.transition === 'fade' ? 'fade' : 'slide',
      showArrows: slider.showArrows,
      showIndicators: slider.showIndicators,
      pauseOnHover: slider.pauseOnHover
    },
    items: resolved
  }
  await kv.set(cacheKey, payload, CACHE_TTL).catch(() => undefined)
  return payload
}

/* ---------------- boot seed ---------------- */

export async function ensureDefaultSlider(): Promise<void> {
  if (!isBlogDbReady()) return
  if (await findSliderByKey('home.hero')) return
  await insertSlider({
    key: 'home.hero',
    name: '首页轮播',
    enabled: false,
    autoplay: true,
    intervalMs: 5000,
    transition: 'slide',
    showArrows: true,
    showIndicators: true,
    pauseOnHover: true,
    sortOrder: 0
  })
}
