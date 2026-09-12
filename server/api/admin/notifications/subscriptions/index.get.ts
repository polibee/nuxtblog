import { requirePermission } from '../../../../utils/auth'
import { listNotificationSubscriptions } from '../../../../repositories/notification-subscription.runtime.repository'

/** GET /api/admin/notifications/subscriptions — with channel + event
    names joined for the list view. */
export default defineEventHandler(async (event) => {
  await requirePermission(event, 'notifications.view')
  return { items: await listNotificationSubscriptions() }
})
