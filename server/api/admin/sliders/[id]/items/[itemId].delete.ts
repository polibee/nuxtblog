import { requirePermission } from '../../../../../utils/auth'
import { deleteSliderItem } from '../../../../../modules/slider/slider.service'

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'sliders.edit')
  const id = Number(getRouterParam(event, 'id'))
  const itemId = Number(getRouterParam(event, 'itemId'))
  if (!Number.isInteger(id) || id <= 0 || !Number.isInteger(itemId) || itemId <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid id' })
  }
  await deleteSliderItem(id, itemId)
  return { ok: true }
})
