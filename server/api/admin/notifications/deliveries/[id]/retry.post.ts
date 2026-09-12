import { requirePermission } from '../../../../../utils/auth'
import { deliverOne } from '../../../../../modules/notifications/engine'

/** POST /api/admin/notifications/deliveries/:id/retry — manual retry
    (webhook.txt §53): resets to pending and delivers immediately. */
export default defineEventHandler(async (event) => {
  await requirePermission(event, 'notifications.edit')
  const id = Number(getRouterParam(event, 'id')) || 0
  if (!id) throw createError({ statusCode: 422, statusMessage: 'invalid id' })
  await deliverOne(id)
  return { ok: true }
})
