import { asc, eq } from 'drizzle-orm'
import { getDb, isBlogDbReady } from '../../../repositories/db.server'
import { adSlots } from '../../../repositories/schema/advertising'

/** GET /api/public/advertising/slots — enabled ad slots for the purchase form */
export default defineEventHandler(async () => {
  if (!isBlogDbReady()) return { slots: [] }
  const slots = await getDb()
    .select({ key: adSlots.key, name: adSlots.name, billingUnit: adSlots.billingUnit, priceMinor: adSlots.priceMinor, currency: adSlots.currency })
    .from(adSlots)
    .where(eq(adSlots.enabled, true))
    .orderBy(asc(adSlots.id))
  return { slots }
})
