import { requirePermission } from '../../../../utils/auth'
import { deleteNotificationChannel } from '../../../../repositories/notification-channel.runtime.repository'

/** DELETE /api/admin/notifications/channels/:id — blocked while
    subscriptions still reference it. */
export default defineEventHandler(async (event) => {
  await requirePermission(event, 'notifications.edit')
  const id = Number(getRouterParam(event, 'id')) || 0
  if (!id) throw createError({ statusCode: 422, statusMessage: 'invalid id' })
  try {
    const result = await deleteNotificationChannel(id)
    if (result === 'disabled') {
      throw createError({ statusCode: 409, statusMessage: 'Channel has delivery history — disabled instead of deleted' })
    }
  } catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error) throw error
    throw createError({ statusCode: 409, statusMessage: 'Delete its subscriptions first' })
  }
  return { ok: true }
})
