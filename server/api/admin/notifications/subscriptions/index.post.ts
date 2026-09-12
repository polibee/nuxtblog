import { requirePermission } from '../../../../utils/auth'
import { insertNotificationSubscription } from '../../../../repositories/notification-subscription.runtime.repository'

/** POST /api/admin/notifications/subscriptions — create with the event
    list (webhook.txt §27). */
export default defineEventHandler(async (event) => {
  await requirePermission(event, 'notifications.edit')
  const body = await readBody(event) as {
    name?: string
    channelId?: number
    enabled?: boolean
    minimumSeverity?: string | null
    events?: string[]
  }
  const name = String(body?.name ?? '').trim().slice(0, 80)
  const channelId = Number(body?.channelId) || 0
  const events = Array.isArray(body?.events) ? body.events.map(String).slice(0, 100) : []
  if (!name || !channelId) throw createError({ statusCode: 422, statusMessage: 'name and channel are required' })
  if (events.length === 0) throw createError({ statusCode: 422, statusMessage: 'select at least one event' })
  const id = await insertNotificationSubscription({
    name, channelId, enabled: body?.enabled === undefined ? true : Boolean(body.enabled),
    minimumSeverity: ['info', 'warning', 'error', 'critical'].includes(String(body?.minimumSeverity))
      ? String(body.minimumSeverity)
      : null, events
  })
  return { id }
})
