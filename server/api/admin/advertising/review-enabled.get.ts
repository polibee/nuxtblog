import { requirePermission } from '../../../utils/auth'
import { getReviewEnabled } from '../../../modules/advertising/ad-purchase.service'

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'advertising.view')
  return { enabled: await getReviewEnabled() }
})
