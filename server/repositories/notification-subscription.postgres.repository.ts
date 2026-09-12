import { and, desc, eq, inArray } from 'drizzle-orm'
import { getPostgresDb } from './db-postgres.server'
import { notificationChannels, notificationSubscriptionEvents, notificationSubscriptions } from './schema-postgres/notifications'
import type { NotificationSubscriptionInput, NotificationSubscriptionPatch, NotificationSubscriptionView } from './notification-subscription.repository'

export async function listNotificationSubscriptions(): Promise<NotificationSubscriptionView[]> {
  const db = getPostgresDb()
  const subs = await db.select().from(notificationSubscriptions).orderBy(desc(notificationSubscriptions.id)).limit(100)
  const ids = subs.map(row => row.id)
  const events = ids.length ? await db.select().from(notificationSubscriptionEvents).where(inArray(notificationSubscriptionEvents.subscriptionId, ids)) : []
  const channels = await db.select({ id: notificationChannels.id, name: notificationChannels.name, provider: notificationChannels.provider }).from(notificationChannels)
  const byId = new Map(channels.map(channel => [channel.id, channel] as const))
  return subs.map(sub => ({ id: sub.id, name: sub.name, enabled: sub.enabled, minimumSeverity: sub.minimumSeverity, channel: byId.get(sub.channelId) ?? null, events: events.filter(event => event.subscriptionId === sub.id).map(event => event.eventName) }))
}

export async function insertNotificationSubscription(input: NotificationSubscriptionInput): Promise<number> {
  return getPostgresDb().transaction(async (tx) => {
    const [row] = await tx.insert(notificationSubscriptions).values(input).returning({ id: notificationSubscriptions.id })
    if (!row) throw new Error('notification subscription insert returned no id')
    await tx.insert(notificationSubscriptionEvents).values(input.events.map(eventName => ({ subscriptionId: row.id, eventName })))
    return row.id
  })
}

export async function updateNotificationSubscription(id: number, patch: NotificationSubscriptionPatch): Promise<void> {
  await getPostgresDb().transaction(async (tx) => {
    const { events, ...rowPatch } = patch
    if (Object.keys(rowPatch).length) await tx.update(notificationSubscriptions).set(rowPatch).where(eq(notificationSubscriptions.id, id))
    if (events) {
      await tx.delete(notificationSubscriptionEvents).where(eq(notificationSubscriptionEvents.subscriptionId, id))
      if (events.length) await tx.insert(notificationSubscriptionEvents).values(events.map(eventName => ({ subscriptionId: id, eventName })))
    }
  })
}

export async function deleteNotificationSubscription(id: number): Promise<void> {
  await getPostgresDb().delete(notificationSubscriptions).where(eq(notificationSubscriptions.id, id))
}
export async function listEnabledSubscriptions() {
  return getPostgresDb().select({ id: notificationSubscriptions.id, channelId: notificationSubscriptions.channelId, minimumSeverity: notificationSubscriptions.minimumSeverity }).from(notificationSubscriptions).where(eq(notificationSubscriptions.enabled, true))
}
export async function listMatchedSubscriptionIds(ids: number[], eventName: string) {
  return ids.length ? getPostgresDb().select({ subscriptionId: notificationSubscriptionEvents.subscriptionId }).from(notificationSubscriptionEvents).where(and(inArray(notificationSubscriptionEvents.subscriptionId, ids), eq(notificationSubscriptionEvents.eventName, eventName))) : []
}
