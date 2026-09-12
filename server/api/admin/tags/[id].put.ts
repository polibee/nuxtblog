import { requirePermission } from '../../../utils/auth'
import { updateTaxonomyItem } from '../../../modules/taxonomy/taxonomy.service'

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'tags.edit')
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid id' })
  }
  const body = await readBody(event)
  return updateTaxonomyItem('tag', id, body)
})
