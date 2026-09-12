import { requirePermission } from '../../../utils/auth'
import { listTaxonomyItems } from '../../../modules/taxonomy/taxonomy.service'
import type { Paginated } from '#shared/types/api'

/** GET /api/admin/categories — real taxonomy (P04) */
export default defineEventHandler(async (event) => {
  await requirePermission(event, 'categories.view')
  const items = await listTaxonomyItems('category')
  const withName = items.map(it => ({ ...it, name: Object.values(it.translations)[0]?.name ?? it.alias }))
  const result: Paginated<(typeof items)[number]> = {
    items: withName,
    total: withName.length,
    page: 1,
    perPage: Math.max(items.length, 1),
    totalPages: 1
  }
  return result
})
