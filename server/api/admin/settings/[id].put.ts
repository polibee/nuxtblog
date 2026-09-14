import { requirePermission } from '../../../utils/auth'
import { invalidatePageCache } from '../../../utils/pageCache'
import { updateSettingValue } from '../../../modules/settings/settings.service'
import { maskSettingValue } from '../../../utils/setting-secrets'

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'settings.edit')
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid id' })
  }
  const body = await readBody<{ value?: string | number | boolean }>(event)
  if (body?.value === undefined) {
    throw createError({ statusCode: 422, statusMessage: 'value is required' })
  }
  const updated = await updateSettingValue(id, body.value)
  // page cache keys are locale-scoped; purge all on settings writes
  await invalidatePageCache()
  return { ...updated, value: maskSettingValue(updated.value, updated.type) }
})
