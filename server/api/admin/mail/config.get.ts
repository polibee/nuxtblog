import type { MailConfig } from '../../../utils/mail'
import { getMailConfig } from '../../../utils/mail'
import { requirePermission } from '../../../utils/auth'

/** GET /api/admin/mail/config — current provider config (secrets never echoed) */
export default defineEventHandler(async (event) => {
  await requirePermission(event, 'settings.edit')
  const config: MailConfig = await getMailConfig()
  return config
})
