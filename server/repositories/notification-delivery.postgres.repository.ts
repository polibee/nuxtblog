import { and, eq, lte } from 'drizzle-orm'
import { getPostgresDb } from './db-postgres.server'
import { eventOutbox, notificationChannels, notificationDeliveries } from './schema-postgres/notifications'
import type { DeliveryRow, ChannelRow, OutboxRow } from './notification-delivery.repository'

export async function findDelivery(id: number): Promise<DeliveryRow | undefined> {
  const [row] = await getPostgresDb().select().from(notificationDeliveries).where(eq(notificationDeliveries.id, id)).limit(1)
  return row
}
export async function findDeliveryContext(delivery: DeliveryRow): Promise<{ channel?: ChannelRow, outbox?: OutboxRow }> {
  const [channel] = await getPostgresDb().select().from(notificationChannels).where(eq(notificationChannels.id, delivery.channelId)).limit(1)
  const [outbox] = await getPostgresDb().select().from(eventOutbox).where(eq(eventOutbox.id, delivery.outboxId)).limit(1)
  return { channel, outbox }
}
export async function updateDelivery(id: number, patch: Partial<DeliveryRow>): Promise<void> {
  await getPostgresDb().update(notificationDeliveries).set(patch).where(eq(notificationDeliveries.id, id))
}
export async function listDueDeliveries(now: Date): Promise<Array<{ id: number }>> {
  return getPostgresDb().select({ id: notificationDeliveries.id }).from(notificationDeliveries).where(and(eq(notificationDeliveries.status, 'failed'), lte(notificationDeliveries.nextRetryAt, now))).limit(50)
}
export async function insertDelivery(input: { outboxId: number, subscriptionId: number, channelId: number, provider: string }): Promise<number> {
  const [row] = await getPostgresDb().insert(notificationDeliveries).values({ ...input, status: 'pending' }).returning({ id: notificationDeliveries.id })
  if (!row) throw new Error('delivery insert returned no id')
  return row.id
}
export async function listPendingDeliveries(outboxId: number): Promise<Array<{ id: number }>> {
  return getPostgresDb().select({ id: notificationDeliveries.id }).from(notificationDeliveries).where(and(eq(notificationDeliveries.outboxId, outboxId), eq(notificationDeliveries.status, 'pending')))
}
