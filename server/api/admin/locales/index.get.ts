import { requirePermission } from '../../../utils/auth'
import { listRegistryLocales } from '../../../modules/locales/locale.service'
import type { Paginated } from '#shared/types/api'
import type { LocaleSummary } from '#shared/types/locale'

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'locales.view')
  const locales = await listRegistryLocales()
  const result: Paginated<LocaleSummary> = {
    items: locales,
    total: locales.length,
    page: 1,
    perPage: Math.max(locales.length, 1),
    totalPages: 1
  }
  return result
})
