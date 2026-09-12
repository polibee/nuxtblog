import { createError } from 'h3'
import { requirePermission } from '../../../utils/auth'
import { isBlogDbReady } from '../../../repositories/db.server'
import { findLocaleById } from '../../../repositories/locale.repository'

/** GET /api/admin/locales/:id — locale registry detail (MySQL).
    Without this the request fell through to the base demo-store
    parametric route and 500'd. */
export default defineEventHandler(async (event) => {
  await requirePermission(event, 'locales.view')
  if (!isBlogDbReady()) {
    throw createError({ statusCode: 503, statusMessage: 'Database unavailable' })
  }
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid id' })
  }
  const locale = await findLocaleById(id)
  if (!locale) {
    throw createError({ statusCode: 404, statusMessage: `Locale #${id} not found` })
  }
  return locale
})
