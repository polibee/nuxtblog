import { requirePermission } from '../../../utils/auth'
import { listTaxonomyItems } from '../../../modules/taxonomy/taxonomy.service'

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'categories.view')
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid id' })
  }
  const item = (await listTaxonomyItems('category')).find(t => t.id === id)
  if (!item) {
    throw createError({ statusCode: 404, statusMessage: `Category #${id} not found` })
  }
  return item
})
