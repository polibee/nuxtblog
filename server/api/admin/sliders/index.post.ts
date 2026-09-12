import { requirePermission } from '../../../utils/auth'
import { createSlider } from '../../../modules/slider/slider.service'

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'sliders.edit')
  const body = await readBody(event)
  return createSlider(body)
})
