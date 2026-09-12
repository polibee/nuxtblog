import { desc, eq } from 'drizzle-orm'
import { requirePermission } from '../../../../utils/auth'
import { getDb } from '../../../../repositories/db.server'
import { notificationChannels, notificationDeliveries } from '../../../../repositories/schema/notifications'

/** GET /api/admin/notifications/deliveries?status= — delivery logs
    (webhook.txt §52). */
export default defineEventHandler(async (event) => {
  await requirePermission(event, 'notifications.view')
  const query = getQuery(event) as { status?: string }
  const db = getDb()
  const base = db.select({
    id: notificationDeliveries.id,
    outboxId: notificationDeliveries.outboxId,
    provider: notificationDeliveries.provider,
    channelId: notificationDeliveries.channelId,
    channelName: notificationChannels.name,
    status: notificationDeliveries.status,
    attemptCount: notificationDeliveries.attemptCount,
    responseSummary: notificationDeliveries.responseSummary,
    lastError: notificationDeliveries.lastError,
    createdAt: notificationDeliveries.createdAt,
    sentAt: notificationDeliveries.sentAt
  })
    .from(notificationDeliveries)
    .leftJoin(notificationChannels, eq(notificationChannels.id, notificationDeliveries.channelId))
  const rows = query.status && ['pending', 'sending', 'success', 'failed', 'dead'].includes(query.status)
    ? await base.where(eq(notificationDeliveries.status, query.status)).orderBy(desc(notificationDeliveries.id)).limit(100)
    : await base.orderBy(desc(notificationDeliveries.id)).limit(100)
  return { items: rows }
})
