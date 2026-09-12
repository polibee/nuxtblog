import { requirePermission } from '../../../utils/auth'
import { createLocale } from '../../../modules/locales/locale.service'

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'locales.create')
  const body = await readBody(event)
  return createLocale(body)
})
