import { resolveLocale } from '../../../utils/locale'
import { resolvePublicSlider } from '../../../modules/slider/slider.service'

/** GET /api/public/sliders/:key — resolved slider config + slides for
    the locale (translation fallback to default locale happens here). */
export default defineEventHandler(async (event) => {
  const key = String(getRouterParam(event, 'key') ?? '')
  const query = getQuery(event) as { locale?: string }
  const locale = query.locale
    ? { code: query.locale }
    : await resolveLocale(event.path, getRequestHeader(event, 'accept-language'))
  return resolvePublicSlider(key, locale.code)
})
