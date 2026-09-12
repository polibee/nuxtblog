import { requirePermission } from '../../../utils/auth'
import { setPurchaseEnabled } from '../../../modules/advertising/ad-purchase.service'

/** PUT /api/admin/advertising/purchase-enabled — toggle the public
    ad purchase page on/off. */
export default defineEventHandler(async (event) => {
  await requirePermission(event, 'advertising.edit')
  const body = await readBody(event) as { enabled?: boolean }
  await setPurchaseEnabled(Boolean(body?.enabled))
  return { enabled: Boolean(body?.enabled) }
})
