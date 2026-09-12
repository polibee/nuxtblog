import { requirePermission } from '../../../utils/auth'
import { getPurchaseEnabled } from '../../../modules/advertising/ad-purchase.service'

/** GET /api/admin/advertising/purchase-enabled */
export default defineEventHandler(async (event) => {
  await requirePermission(event, 'advertising.view')
  return { enabled: await getPurchaseEnabled() }
})
