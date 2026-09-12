import { resolveLocale } from '../../utils/locale'
import { getSessionUser } from '../../utils/auth'
import { listLocales } from '../../repositories/locale.repository'
import { resolveSlot } from '../../modules/advertising/advertising.service'
import type { Viewer } from '../../modules/advertising/types'

/* POST /api/advertising/resolve — single-slot decision (impl doc §6).
   Membership state comes from the session cookie and never lands in
   SSR HTML: pages render an empty placeholder and resolve here. */

export default defineEventHandler(async (event) => {
  const body = await readBody(event) as { slot?: string, path?: string, locale?: string } | null
  const slot = body?.slot?.trim() ?? ''
  const path = body?.path?.trim() ?? '/'
  if (!slot) {
    throw createError({ statusCode: 400, statusMessage: 'slot is required' })
  }
  const locale = body?.locale
    ? { code: body.locale }
    : await resolveLocale(event.path, getRequestHeader(event, 'accept-language'))

  const user = await getSessionUser(event)
  const viewer: Viewer | null = user ? { id: user.id, email: user.email } : null

  const locales = await listLocales()
  const localeId = locales.find(l => l.code === locale.code)?.id
    ?? locales.find(l => l.isDefault)?.id
    ?? 1

  return resolveSlot(slot, path, localeId, viewer)
})
