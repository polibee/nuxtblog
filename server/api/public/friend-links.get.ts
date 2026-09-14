import { isDomainDbReady } from '../../repositories/domain-status'
import { listPublicFriendLinkCategories } from '../../repositories/friend-link-category.runtime.repository'
import { getPublicFriendLinks } from '../../modules/friend-links/friend-links.runtime.service'
import { getSettingValue } from '../../modules/settings/settings.runtime.service'
import { resolveLocale } from '../../utils/locale'

/** GET /api/public/friend-links — active links + categories for the
    friend_links page template (友链 §75: public reads may be SSR
    service data; a narrow REST endpoint keeps caching simple). */
export default defineEventHandler(async (event) => {
  if (String(await getSettingValue('friend_links.enabled', 'true')) === 'false') {
    return { links: [], categories: [], site: null }
  }
  const links = await getPublicFriendLinks()
  let categories: Array<{ id: number, name: string }> = []
  if (isDomainDbReady()) {
    const locale = await resolveLocale(event.path, getRequestHeader(event, 'accept-language'))
    categories = (await listPublicFriendLinkCategories(locale.id)).map(({ id, name }) => ({ id, name }))
  }
  const site = {
    name: String(await getSettingValue('SITE_NAME', 'Blog Framework')),
    url: String(await getSettingValue('SITE_URL', '')),
    description: String(await getSettingValue('SITE_DESCRIPTION', '')),
    friendsPagePath: '/friends'
  }
  return { links, categories, site }
})

