import { createError } from 'h3'
import { requirePermission } from '../../../../utils/auth'
import { getDb, isBlogDbReady } from '../../../../repositories/db.server'
import { listLocales } from '../../../../repositories/locale.repository'
import { adCreativeTranslations, adCreatives } from '../../../../repositories/schema/advertising'

/** POST /api/admin/advertising/creatives — create creative + translations.
    Translations: { [localeCode]: { title, content?, buttonText?, imageId?, targetUrl?, altText? } } */
export default defineEventHandler(async (event) => {
  await requirePermission(event, 'advertising.create')
  if (!isBlogDbReady()) {
    throw createError({ statusCode: 503, statusMessage: 'Database unavailable' })
  }
  const body = await readBody(event) as {
    campaignId?: number
    provider?: string
    weight?: number
    enabled?: boolean
    translations?: Record<string, {
      title?: string
      content?: string
      buttonText?: string
      imageId?: number
      targetUrl?: string
      altText?: string
    }>
  } | null

  const campaignId = Number(body?.campaignId)
  if (!Number.isInteger(campaignId) || campaignId <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'campaignId is required' })
  }
  const provider = ['image', 'affiliate', 'adsense'].includes(body?.provider ?? '') ? body!.provider! : 'image'
  const translations = body?.translations ?? {}
  const entries = Object.entries(translations).filter(([, f]) => (f.title ?? '').trim())
  if (entries.length === 0) {
    throw createError({ statusCode: 422, statusMessage: 'At least one translation with a title is required' })
  }

  const locales = await listLocales()
  const codeToId = new Map(locales.map(l => [l.code, l.id]))

  const [creative] = await getDb().insert(adCreatives).values({
    campaignId,
    provider,
    weight: Number.isInteger(body?.weight) ? Number(body!.weight) : 1,
    enabled: body?.enabled ?? true
  })
  const creativeId = creative!.insertId

  for (const [code, fields] of entries) {
    const localeId = codeToId.get(code)
    if (!localeId) continue
    await getDb().insert(adCreativeTranslations).values({
      creativeId,
      localeId,
      title: (fields.title ?? '').trim(),
      content: fields.content ?? null,
      buttonText: fields.buttonText?.trim() || null,
      imageId: typeof fields.imageId === 'number' && fields.imageId > 0 ? fields.imageId : null,
      targetUrl: fields.targetUrl?.trim() || null,
      altText: fields.altText?.trim() || null
    })
  }
  return { id: creativeId }
})
