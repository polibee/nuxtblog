import { getPurchaseEnabled } from '../../../modules/advertising/ad-purchase.service'
import { applyForAd } from '../../../modules/advertising/ad-purchase.service'

/** POST /api/public/advertising/apply — self-serve ad application:
    creates the campaign with materials + the budget order. */
export default defineEventHandler(async (event) => {
  if (!(await getPurchaseEnabled())) {
    throw createError({ statusCode: 403, statusMessage: 'Ad purchase is currently disabled' })
  }
  const body = await readBody(event)
  return applyForAd({
    materialTitle: String(body?.materialTitle ?? ''),
    materialDescription: String(body?.materialDescription ?? ''),
    materialImageMediaId: Number(body?.materialImageMediaId) || 0,
    materialUrl: String(body?.materialUrl ?? ''),
    materialSlotKey: String(body?.materialSlotKey ?? ''),
    contactEmail: String(body?.contactEmail ?? ''),
    budgetMinor: Number(body?.budgetMinor) || 0
  })
})
