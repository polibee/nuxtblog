import { requirePermission } from '../../../../utils/auth'
import { deleteNotificationSubscription } from '../../../../repositories/notification-subscription.runtime.repository'

/** DELETE /api/admin/notifications/subscriptions/:id. */
export default defineEventHandler(async (event) => {
  await requirePermission(event, 'notifications.edit')
  const id = Number(getRouterParam(event, 'id')) || 0
  if (!id) throw createError({ statusCode: 422, statusMessage: 'invalid id' })
  await deleteNotificationSubscription(id)
  return { ok: true }
})
