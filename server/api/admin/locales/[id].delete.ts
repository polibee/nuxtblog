import { requirePermission } from '../../../utils/auth'
import { deleteLocale } from '../../../modules/locales/locale.service'

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'locales.delete')
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid id' })
  }
  await deleteLocale(id)
  return { removed: 1 }
})
