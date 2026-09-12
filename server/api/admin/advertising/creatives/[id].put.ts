import { eq } from 'drizzle-orm'
import { createError } from 'h3'
import { requirePermission } from '../../../../utils/auth'
import { getDb, isBlogDbReady } from '../../../../repositories/db.server'
import { listLocales } from '../../../../repositories/locale.repository'
import { adCreativeTranslations, adCreatives } from '../../../../repositories/schema/advertising'

/** PUT /api/admin/advertising/creatives/:id — replace translations, update scalars */
export default defineEventHandler(async (event) => {
  await requirePermission(event, 'advertising.edit')
  if (!isBlogDbReady()) {
    throw createError({ statusCode: 503, statusMessage: 'Database unavailable' })
  }
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid id' })
  }
  const body = await readBody(event) as {
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

  const patch: { provider?: string, weight?: number, enabled?: boolean } = {}
  if (body?.provider !== undefined && ['image', 'affiliate', 'adsense'].includes(body.provider)) patch.provider = body.provider
  if (body?.weight !== undefined) patch.weight = Number(body.weight) || 1
  if (body?.enabled !== undefined) patch.enabled = body.enabled
  if (Object.keys(patch).length > 0) {
    await getDb().update(adCreatives).set(patch).where(eq(adCreatives.id, id))
  }

  if (body?.translations !== undefined) {
    const locales = await listLocales()
    const codeToId = new Map(locales.map(l => [l.code, l.id]))
    const entries = Object.entries(body.translations)
    const unknownLocale = entries.find(([code]) => !codeToId.has(code))
    if (unknownLocale) {
      throw createError({ statusCode: 422, statusMessage: `Unknown locale "${unknownLocale[0]}"` })
    }
    await getDb().delete(adCreativeTranslations).where(eq(adCreativeTranslations.creativeId, id))
    for (const [code, fields] of entries) {
      const localeId = codeToId.get(code)!
      await getDb().insert(adCreativeTranslations).values({
        creativeId: id,
        localeId,
        title: (fields.title ?? '').trim(),
        content: fields.content ?? null,
        buttonText: fields.buttonText?.trim() || null,
        imageId: typeof fields.imageId === 'number' && fields.imageId > 0 ? fields.imageId : null,
        targetUrl: fields.targetUrl?.trim() || null,
        altText: fields.altText?.trim() || null
      })
    }
  }
  return { ok: true }
})
