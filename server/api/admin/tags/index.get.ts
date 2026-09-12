import { requirePermission } from '../../../utils/auth'
import { listTaxonomyItems } from '../../../modules/taxonomy/taxonomy.service'
import type { Paginated } from '#shared/types/api'

/** GET /api/admin/tags — real taxonomy (P04) */
export default defineEventHandler(async (event) => {
  await requirePermission(event, 'tags.view')
  const items = await listTaxonomyItems('tag')
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
