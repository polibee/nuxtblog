import { requirePermission } from '../../../../utils/auth'
import { updateNotificationSubscription } from '../../../../repositories/notification-subscription.runtime.repository'

/** PATCH /api/admin/notifications/subscriptions/:id — full replace of
    the event list; simple and predictable. */
export default defineEventHandler(async (event) => {
  await requirePermission(event, 'notifications.edit')
  const id = Number(getRouterParam(event, 'id')) || 0
  if (!id) throw createError({ statusCode: 422, statusMessage: 'invalid id' })
  const body = await readBody(event) as {
    name?: string
    enabled?: boolean
    minimumSeverity?: string | null
    events?: string[]
  }
  const patch: { name?: string, enabled?: boolean, minimumSeverity?: string | null, events?: string[] } = {}
  if (body?.name !== undefined) patch.name = String(body.name).trim().slice(0, 80)
  if (body?.enabled !== undefined) patch.enabled = Boolean(body.enabled)
  if (body?.minimumSeverity !== undefined) {
    patch.minimumSeverity = ['info', 'warning', 'error', 'critical'].includes(String(body.minimumSeverity))
      ? String(body.minimumSeverity)
      : null
  }
  if (Array.isArray(body?.events)) patch.events = body.events.map(String).slice(0, 100)
  await updateNotificationSubscription(id, patch)
  return { ok: true }
})
