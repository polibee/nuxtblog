import { requirePermission } from '../../../utils/auth'
import { deleteTaxonomyItem } from '../../../modules/taxonomy/taxonomy.service'

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'tags.delete')
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid id' })
  }
  await deleteTaxonomyItem('tag', id)
  return { removed: 1 }
})
