import { desc, eq } from 'drizzle-orm'
import { requirePermission } from '../../../../utils/auth'
import { getDb, isBlogDbReady } from '../../../../repositories/db.server'
import { adCampaigns, adCreativeTranslations, adCreatives } from '../../../../repositories/schema/advertising'
import { listLocales } from '../../../../repositories/locale.repository'

/** GET /api/admin/advertising/creatives — creatives with translations keyed by locale code */
export default defineEventHandler(async (event) => {
  await requirePermission(event, 'advertising.view')
  if (!isBlogDbReady()) {
    throw createError({ statusCode: 503, statusMessage: 'Database unavailable' })
  }
  const locales = await listLocales() as Array<{ id: number, code: string }>
  const codeToId = new Map(locales.map(l => [l.id, l.code]))
  const creatives = await getDb().select({
    creative: adCreatives,
    campaignName: adCampaigns.name
  }).from(adCreatives).leftJoin(adCampaigns, eq(adCreatives.campaignId, adCampaigns.id)).orderBy(desc(adCreatives.createdAt))
  const rows = await getDb().select().from(adCreativeTranslations)
  const items = creatives.map(({ creative, campaignName }) => {
    const translations: Record<string, Record<string, unknown>> = {}
    for (const tr of rows.filter(r => r.creativeId === creative.id)) {
      const code = codeToId.get(tr.localeId)
      if (!code) continue
      translations[code] = {
        title: tr.title,
        content: tr.content ?? '',
        buttonText: tr.buttonText ?? '',
        imageId: tr.imageId,
        targetUrl: tr.targetUrl ?? '',
        altText: tr.altText ?? ''
      }
    }
    return { ...creative, campaignName, translations }
  })
  return { items, total: items.length, page: 1, perPage: Math.max(items.length, 1), totalPages: 1 }
})
