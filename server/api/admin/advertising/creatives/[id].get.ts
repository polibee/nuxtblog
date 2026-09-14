import { eq } from 'drizzle-orm'
import { createError } from 'h3'
import { requirePermission } from '../../../../utils/auth'
import { getDb, isBlogDbReady } from '../../../../repositories/db.server'
import { adCampaigns, adCreativeTranslations, adCreatives } from '../../../../repositories/schema/advertising'
import { listLocales } from '../../../../repositories/locale.repository'

/** GET /api/admin/advertising/creatives/:id — edit form payload */
export default defineEventHandler(async (event) => {
  await requirePermission(event, 'advertising.view')
  if (!isBlogDbReady()) throw createError({ statusCode: 503, statusMessage: 'Database unavailable' })
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) throw createError({ statusCode: 400, statusMessage: 'Invalid id' })
  const db = getDb()
  const [row] = await db.select({ creative: adCreatives, campaignName: adCampaigns.name }).from(adCreatives)
    .leftJoin(adCampaigns, eq(adCreatives.campaignId, adCampaigns.id)).where(eq(adCreatives.id, id)).limit(1)
  if (!row) throw createError({ statusCode: 404, statusMessage: 'Creative not found' })
  const locales = await listLocales()
  const codeById = new Map(locales.map(locale => [locale.id, locale.code]))
  const translations: Record<string, Record<string, unknown>> = {}
  const rows = await db.select().from(adCreativeTranslations).where(eq(adCreativeTranslations.creativeId, id))
  for (const translation of rows) {
    const code = codeById.get(translation.localeId)
    if (code) translations[code] = { title: translation.title, content: translation.content ?? '', buttonText: translation.buttonText ?? '', imageId: translation.imageId, targetUrl: translation.targetUrl ?? '', altText: translation.altText ?? '' }
  }
  return { ...row.creative, campaignName: row.campaignName, translations }
})
