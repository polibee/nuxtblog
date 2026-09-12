import { resolveLocale } from '../../utils/locale'
import { listPublicSidebarCards } from '../../modules/sidebar/sidebar-card.service'

/** public sidebar cards for the resolved content locale (no cross-locale fallback) */
export default defineEventHandler(async (event) => {
  const locale = await resolveLocale(
    event.path,
    getRequestHeader(event, 'accept-language')
  )
  const cards = await listPublicSidebarCards(locale.code)
  return { locale: locale.code, cards }
})
