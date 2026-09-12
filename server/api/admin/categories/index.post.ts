import { requirePermission } from '../../../utils/auth'
import { createTaxonomyItem } from '../../../modules/taxonomy/taxonomy.service'

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'categories.create')
  const body = await readBody(event)
  return createTaxonomyItem('category', body)
})
