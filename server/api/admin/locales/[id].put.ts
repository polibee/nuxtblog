import { requirePermission } from '../../../utils/auth'
import { updateLocale } from '../../../modules/locales/locale.service'

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'locales.edit')
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid id' })
  }
  const body = await readBody(event)
  return updateLocale(id, body)
})
