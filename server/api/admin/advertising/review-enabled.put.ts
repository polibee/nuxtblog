import { requirePermission } from '../../../utils/auth'
import { setReviewEnabled } from '../../../modules/advertising/ad-purchase.service'

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'advertising.edit')
  const body = await readBody(event) as { enabled?: boolean }
  await setReviewEnabled(Boolean(body?.enabled))
  return { enabled: Boolean(body?.enabled) }
})
