import { and, desc, eq, inArray } from 'drizzle-orm'
import { getDb } from './db.server'
import { notificationChannels, notificationSubscriptionEvents, notificationSubscriptions } from './schema/notifications'

export interface NotificationSubscriptionInput { name: string, channelId: number, enabled: boolean, minimumSeverity: string | null, events: string[] }
export interface NotificationSubscriptionPatch { name?: string, enabled?: boolean, minimumSeverity?: string | null, events?: string[] }
export interface NotificationSubscriptionView { id: number, name: string, enabled: boolean, minimumSeverity: string | null, channel: { id: number, name: string, provider: string } | null, events: string[] }

export async function listNotificationSubscriptions(): Promise<NotificationSubscriptionView[]> {
  const db = getDb()
  const subs = await db.select().from(notificationSubscriptions).orderBy(desc(notificationSubscriptions.id)).limit(100)
  const ids = subs.map(row => row.id)
  const events = ids.length ? await db.select().from(notificationSubscriptionEvents).where(inArray(notificationSubscriptionEvents.subscriptionId, ids)) : []
  const channels = await db.select({ id: notificationChannels.id, name: notificationChannels.name, provider: notificationChannels.provider }).from(notificationChannels)
  const byId = new Map(channels.map(channel => [channel.id, channel] as const))
  return subs.map(sub => ({ id: sub.id, name: sub.name, enabled: sub.enabled, minimumSeverity: sub.minimumSeverity, channel: byId.get(sub.channelId) ?? null, events: events.filter(event => event.subscriptionId === sub.id).map(event => event.eventName) }))
}

export async function insertNotificationSubscription(input: NotificationSubscriptionInput): Promise<number> {
  return getDb().transaction(async (tx) => {
    const [row] = await tx.insert(notificationSubscriptions).values(input)
    if (!row) throw new Error('notification subscription insert returned no id')
    await tx.insert(notificationSubscriptionEvents).values(input.events.map(eventName => ({ subscriptionId: row.insertId, eventName })))
    return row.insertId
  })
}

export async function updateNotificationSubscription(id: number, patch: NotificationSubscriptionPatch): Promise<void> {
  await getDb().transaction(async (tx) => {
    const { events, ...rowPatch } = patch
    if (Object.keys(rowPatch).length) await tx.update(notificationSubscriptions).set(rowPatch).where(eq(notificationSubscriptions.id, id))
    if (events) {
      await tx.delete(notificationSubscriptionEvents).where(eq(notificationSubscriptionEvents.subscriptionId, id))
      if (events.length) await tx.insert(notificationSubscriptionEvents).values(events.map(eventName => ({ subscriptionId: id, eventName })))
    }
  })
}

export async function deleteNotificationSubscription(id: number): Promise<void> {
  await getDb().delete(notificationSubscriptions).where(eq(notificationSubscriptions.id, id))
}
export async function listEnabledSubscriptions() {
  return getDb().select({ id: notificationSubscriptions.id, channelId: notificationSubscriptions.channelId, minimumSeverity: notificationSubscriptions.minimumSeverity }).from(notificationSubscriptions).where(eq(notificationSubscriptions.enabled, true))
}
export async function listMatchedSubscriptionIds(ids: number[], eventName: string) {
  return ids.length ? getDb().select({ subscriptionId: notificationSubscriptionEvents.subscriptionId }).from(notificationSubscriptionEvents).where(and(inArray(notificationSubscriptionEvents.subscriptionId, ids), eq(notificationSubscriptionEvents.eventName, eventName))) : []
}
