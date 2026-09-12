import { requirePermission } from '../../../../../utils/auth'
import { reorderSlider } from '../../../../../modules/slider/slider.service'

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'sliders.edit')
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid id' })
  }
  const body = await readBody(event) as { ids?: unknown }
  const ids = Array.isArray(body.ids) ? body.ids.map(Number).filter(n => Number.isInteger(n) && n > 0) : []
  if (ids.length === 0) {
    throw createError({ statusCode: 422, statusMessage: 'ids must be a non-empty number array' })
  }
  await reorderSlider(id, ids)
  return { ok: true }
})
