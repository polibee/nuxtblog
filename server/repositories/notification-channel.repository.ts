import { desc, eq } from 'drizzle-orm'
import { getDb } from './db.server'
import { notificationChannels, notificationDeliveries, notificationSubscriptions } from './schema/notifications'

export type NotificationChannelRow = typeof notificationChannels.$inferSelect
export interface NotificationChannelInsert {
  name: string
  provider: string
  configEncrypted: string
  configHint: string
  createdBy: number | null
}
export interface NotificationChannelPatch {
  name?: string
  enabled?: boolean
  configEncrypted?: string
  configHint?: string
}

export async function listNotificationChannels(): Promise<NotificationChannelRow[]> {
  return getDb().select().from(notificationChannels).orderBy(desc(notificationChannels.id)).limit(100)
}

export async function findNotificationChannel(id: number): Promise<NotificationChannelRow | undefined> {
  const [row] = await getDb().select().from(notificationChannels).where(eq(notificationChannels.id, id)).limit(1)
  return row
}
export async function findEnabledNotificationChannel(id: number): Promise<NotificationChannelRow | undefined> {
  const row = await findNotificationChannel(id)
  return row?.enabled ? row : undefined
}

export async function insertNotificationChannel(input: NotificationChannelInsert): Promise<number> {
  const [row] = await getDb().insert(notificationChannels).values({ ...input, enabled: true })
  if (!row) throw new Error('notification channel insert returned no id')
  return row.insertId
}

export async function updateNotificationChannel(id: number, patch: NotificationChannelPatch): Promise<void> {
  await getDb().update(notificationChannels).set(patch).where(eq(notificationChannels.id, id))
}

export async function deleteNotificationChannel(id: number): Promise<'deleted' | 'disabled'> {
  const [history] = await getDb().select({ id: notificationDeliveries.id }).from(notificationDeliveries).where(eq(notificationDeliveries.channelId, id)).limit(1)
  if (history) {
    await updateNotificationChannel(id, { enabled: false })
    return 'disabled'
  }
  const subscriptions = await getDb().select({ id: notificationSubscriptions.id }).from(notificationSubscriptions).where(eq(notificationSubscriptions.channelId, id)).limit(1)
  if (subscriptions.length > 0) throw new Error('Delete its subscriptions first')
  await getDb().delete(notificationChannels).where(eq(notificationChannels.id, id))
  return 'deleted'
}
