import { requirePermission } from '../../../utils/auth'
import { getProfileBundle } from '../../../modules/profile/profile.runtime.service'

/** GET /api/admin/author/profile — full profile bundle for the editor */
export default defineEventHandler(async (event) => {
  await requirePermission(event, 'profile.view')
  return await getProfileBundle()
})
