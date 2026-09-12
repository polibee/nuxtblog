import {
  bigint,
  boolean,
  datetime,
  index,
  int,
  mediumtext,
  mysqlTable,
  primaryKey,
  text,
  varchar
} from 'drizzle-orm/mysql-core'

/* P38 Notification Center (docs/webhook.txt §58-62): channels,
   subscription-centric event routing, transactional outbox and
   per-channel delivery records with retry. */

export const notificationChannels = mysqlTable(
  'notification_channels',
  {
    id: bigint('id', { mode: 'number' }).notNull().autoincrement().primaryKey(),
    name: varchar('name', { length: 80 }).notNull(),
    /* webhook | lark | spug */
    provider: varchar('provider', { length: 20 }).notNull(),
    /* AES-256-GCM encrypted JSON (secrets never plaintext, §7/10) */
    configEncrypted: text('config_encrypted').notNull(),
    configHint: varchar('config_hint', { length: 200 }).notNull().default(''),
    enabled: boolean('enabled').notNull().default(true),
    createdBy: bigint('created_by', { mode: 'number' }),
    createdAt: datetime('created_at', { fsp: 6, mode: 'date' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: datetime('updated_at', { fsp: 6, mode: 'date' })
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdateFn(() => new Date())
  },
  table => [index('notification_channels_provider_idx').on(table.provider, table.enabled)]
)

export const notificationSubscriptions = mysqlTable(
  'notification_subscriptions',
  {
    id: bigint('id', { mode: 'number' }).notNull().autoincrement().primaryKey(),
    name: varchar('name', { length: 80 }).notNull(),
    channelId: bigint('channel_id', { mode: 'number' }).notNull(),
    enabled: boolean('enabled').notNull().default(true),
    /* info | warning | error | critical — null = any (§23) */
    minimumSeverity: varchar('minimum_severity', { length: 20 }),
    createdAt: datetime('created_at', { fsp: 6, mode: 'date' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: datetime('updated_at', { fsp: 6, mode: 'date' })
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdateFn(() => new Date())
  },
  table => [index('notification_subs_channel_idx').on(table.channelId, table.enabled)]
)

export const notificationSubscriptionEvents = mysqlTable(
  'notification_subscription_events',
  {
    subscriptionId: bigint('subscription_id', { mode: 'number' }).notNull(),
    eventName: varchar('event_name', { length: 60 }).notNull()
  },
  table => [
    primaryKey({ columns: [table.subscriptionId, table.eventName] }),
    index('notification_sub_events_name_idx').on(table.eventName)
  ]
)

export const eventOutbox = mysqlTable(
  'event_outbox',
  {
    id: bigint('id', { mode: 'number' }).notNull().autoincrement().primaryKey(),
    eventName: varchar('event_name', { length: 60 }).notNull(),
    module: varchar('module', { length: 30 }).notNull().default(''),
    severity: varchar('severity', { length: 20 }).notNull().default('info'),
    entityType: varchar('entity_type', { length: 40 }),
    entityId: varchar('entity_id', { length: 120 }),
    payloadJson: mediumtext('payload_json').notNull(),
    /* §50: suppressed repeats within the dedup window */
    dedupeKey: varchar('dedupe_key', { length: 150 }),
    suppressedCount: int('suppressed_count').notNull().default(0),
    /* pending | processing | processed | failed */
    status: varchar('status', { length: 20 }).notNull().default('pending'),
    occurredAt: datetime('occurred_at', { fsp: 6, mode: 'date' })
      .notNull()
      .$defaultFn(() => new Date()),
    processedAt: datetime('processed_at', { fsp: 6, mode: 'date' }),
    createdAt: datetime('created_at', { fsp: 6, mode: 'date' })
      .notNull()
      .$defaultFn(() => new Date())
  },
  table => [
    index('event_outbox_status_idx').on(table.status, table.createdAt),
    index('event_outbox_dedupe_idx').on(table.dedupeKey, table.occurredAt)
  ]
)

export const notificationDeliveries = mysqlTable(
  'notification_deliveries',
  {
    id: bigint('id', { mode: 'number' }).notNull().autoincrement().primaryKey(),
    outboxId: bigint('outbox_id', { mode: 'number' }).notNull(),
    subscriptionId: bigint('subscription_id', { mode: 'number' }).notNull(),
    channelId: bigint('channel_id', { mode: 'number' }).notNull(),
    provider: varchar('provider', { length: 20 }).notNull(),
    /* pending | sending | success | failed | dead */
    status: varchar('status', { length: 20 }).notNull().default('pending'),
    attemptCount: int('attempt_count').notNull().default(0),
    responseStatus: int('response_status'),
    responseSummary: varchar('response_summary', { length: 500 }),
    lastError: varchar('last_error', { length: 500 }),
    nextRetryAt: datetime('next_retry_at', { fsp: 6, mode: 'date' }),
    sentAt: datetime('sent_at', { fsp: 6, mode: 'date' }),
    createdAt: datetime('created_at', { fsp: 6, mode: 'date' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: datetime('updated_at', { fsp: 6, mode: 'date' })
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdateFn(() => new Date())
  },
  table => [
    index('notification_del_status_idx').on(table.status, table.nextRetryAt),
    index('notification_del_outbox_idx').on(table.outboxId)
  ]
)
