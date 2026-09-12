import { desc, eq } from 'drizzle-orm'
import { getPostgresDb } from './db-postgres.server'
import { notificationChannels, notificationDeliveries, notificationSubscriptions } from './schema-postgres/notifications'
import type { NotificationChannelInsert, NotificationChannelPatch } from './notification-channel.repository'

export type NotificationChannelRow = typeof notificationChannels.$inferSelect
export async function listNotificationChannels(): Promise<NotificationChannelRow[]> {
  return getPostgresDb().select().from(notificationChannels).orderBy(desc(notificationChannels.id)).limit(100)
}

export async function findNotificationChannel(id: number): Promise<NotificationChannelRow | undefined> {
  const [row] = await getPostgresDb().select().from(notificationChannels).where(eq(notificationChannels.id, id)).limit(1)
  return row
}
export async function findEnabledNotificationChannel(id: number): Promise<NotificationChannelRow | undefined> {
  const row = await findNotificationChannel(id)
  return row?.enabled ? row : undefined
}

export async function insertNotificationChannel(input: NotificationChannelInsert): Promise<number> {
  const [row] = await getPostgresDb().insert(notificationChannels).values({ ...input, enabled: true }).returning({ id: notificationChannels.id })
  if (!row) throw new Error('notification channel insert returned no id')
  return row.id
}

export async function updateNotificationChannel(id: number, patch: NotificationChannelPatch): Promise<void> {
  await getPostgresDb().update(notificationChannels).set(patch).where(eq(notificationChannels.id, id))
}

export async function deleteNotificationChannel(id: number): Promise<'deleted' | 'disabled'> {
  const [history] = await getPostgresDb().select({ id: notificationDeliveries.id }).from(notificationDeliveries).where(eq(notificationDeliveries.channelId, id)).limit(1)
  if (history) {
    await updateNotificationChannel(id, { enabled: false })
    return 'disabled'
  }
  const subscriptions = await getPostgresDb().select({ id: notificationSubscriptions.id }).from(notificationSubscriptions).where(eq(notificationSubscriptions.channelId, id)).limit(1)
  if (subscriptions.length > 0) throw new Error('Delete its subscriptions first')
  await getPostgresDb().delete(notificationChannels).where(eq(notificationChannels.id, id))
  return 'deleted'
}
