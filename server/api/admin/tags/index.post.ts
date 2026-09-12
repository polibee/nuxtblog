import { requirePermission } from '../../../utils/auth'
import { createTaxonomyItem } from '../../../modules/taxonomy/taxonomy.service'

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'tags.create')
  const body = await readBody(event)
  return createTaxonomyItem('tag', body)
})
