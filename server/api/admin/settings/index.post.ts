import { requirePermission } from '../../../utils/auth'
import { createSetting } from '../../../modules/settings/settings.runtime.service'

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'settings.create')
  const body = await readBody(event)
  return createSetting(body)
})
