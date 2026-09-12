import { getPublicProfile } from '../../modules/profile/profile.runtime.service'
import { isDomainDbReady } from '../../repositories/domain-status'
import { findLocaleByCode } from '../../repositories/locale.runtime.repository'

/** GET /api/public/profile — public professional profile page data */
export default defineEventHandler(async (event) => {
  if (!isDomainDbReady()) return null
  const localeCode = getQuery(event).locale
  const locale = typeof localeCode === 'string' ? await findLocaleByCode(localeCode) : undefined
  return await getPublicProfile(locale?.id)
})
