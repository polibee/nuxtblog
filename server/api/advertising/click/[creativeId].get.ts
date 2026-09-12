import { resolveLocale } from '../../../utils/locale'
import { listLocales } from '../../../repositories/locale.repository'
import { recordClick } from '../../../modules/advertising/advertising.service'

/* GET /api/advertising/click/:creativeId?target=... — count the click
   then 302 to the creative target URL. Invalid/missing targets get 404
   so the click is not silently swallowed. */

export default defineEventHandler(async (event) => {
  const creativeId = Number(getRouterParam(event, 'creativeId'))
  if (!Number.isInteger(creativeId) || creativeId <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid creative id' })
  }
  const locale = await resolveLocale(event.path, getRequestHeader(event, 'accept-language'))
  const locales = await listLocales()
  const localeId = locales.find(l => l.code === locale.code)?.id
    ?? locales.find(l => l.isDefault)?.id
    ?? 1

  const target = await recordClick(creativeId, localeId)
  if (!target) {
    throw createError({ statusCode: 404, statusMessage: 'Unknown creative or target' })
  }
  return sendRedirect(event, target, 302)
})
