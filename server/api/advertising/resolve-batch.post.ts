import { resolveLocale } from '../../utils/locale'
import { getSessionUser } from '../../utils/auth'
import { listLocales } from '../../repositories/locale.repository'
import { resolveBatch } from '../../modules/advertising/advertising.service'
import type { Viewer } from '../../modules/advertising/types'

/* POST /api/advertising/resolve-batch — one request per page for all
   AdSlot placeholders (impl doc §4). Results keyed by slot name. */

export default defineEventHandler(async (event) => {
  const body = await readBody(event) as { slots?: string[], path?: string, locale?: string } | null
  const slots = (body?.slots ?? []).map(s => String(s).trim()).filter(Boolean)
  if (slots.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'slots array is required' })
  }
  if (slots.length > 10) {
    throw createError({ statusCode: 400, statusMessage: 'Too many slots in one batch (max 10)' })
  }
  const path = body?.path?.trim() ?? '/'
  const locale = body?.locale
    ? { code: body.locale }
    : await resolveLocale(event.path, getRequestHeader(event, 'accept-language'))

  const user = await getSessionUser(event)
  const viewer: Viewer | null = user ? { id: user.id, email: user.email } : null

  const locales = await listLocales()
  const localeId = locales.find(l => l.code === locale.code)?.id
    ?? locales.find(l => l.isDefault)?.id
    ?? 1

  return { results: await resolveBatch(slots, path, localeId, viewer) }
})
