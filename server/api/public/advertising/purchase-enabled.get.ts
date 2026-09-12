import { getPurchaseEnabled } from '../../../modules/advertising/ad-purchase.service'

/** GET /api/public/advertising/purchase-enabled */
export default defineEventHandler(async () => {
  return { enabled: await getPurchaseEnabled() }
})
