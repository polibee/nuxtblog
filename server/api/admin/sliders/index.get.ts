import { requirePermission } from '../../../utils/auth'
import { listAdminSliders } from '../../../modules/slider/slider.service'

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'sliders.view')
  return { items: await listAdminSliders() }
})
