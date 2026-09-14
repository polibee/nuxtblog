import { requirePermission } from '../../../../utils/auth'
import { deleteNotificationChannel } from '../../../../repositories/notification-channel.runtime.repository'

/** DELETE /api/admin/notifications/channels/:id. Channels with delivery
    history are disabled so that the audit trail remains intact. */
export default defineEventHandler(async (event) => {
  await requirePermission(event, 'notifications.edit')
  const id = Number(getRouterParam(event, 'id')) || 0
  if (!id) throw createError({ statusCode: 422, statusMessage: 'invalid id' })
  try {
    const result = await deleteNotificationChannel(id)
    return { ok: true, action: result }
  } catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error) throw error
    throw createError({ statusCode: 409, statusMessage: 'Delete its subscriptions first' })
  }
})
