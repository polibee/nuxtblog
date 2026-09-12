import { requirePermission } from '../../../utils/auth'
import { getAdminSlider } from '../../../modules/slider/slider.service'

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'sliders.view')
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid id' })
  }
  return getAdminSlider(id)
})
