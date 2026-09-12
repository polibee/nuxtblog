import {
  bigint,
  boolean,
  datetime,
  index,
  int,
  mysqlTable,
  uniqueIndex,
  varchar
} from 'drizzle-orm/mysql-core'

/* Analytics (architecture §11): raw events + session aggregation.
   Privacy: no raw IP, no cookies content, no form data, no PII.
   visitor_key = random first-party id (30d); session_key = 30min window. */

export const analyticsEvents = mysqlTable(
  'analytics_events',
  {
    id: bigint('id', { mode: 'number' }).notNull().autoincrement().primaryKey(),
    eventId: varchar('event_id', { length: 64 }).notNull(),
    eventType: varchar('event_type', { length: 32 }).notNull().default('page_view'),
    occurredAt: datetime('occurred_at', { fsp: 6, mode: 'date' }).notNull(),
    sessionKey: varchar('session_key', { length: 128 }).notNull(),
    visitorKey: varchar('visitor_key', { length: 128 }).notNull(),
    path: varchar('path', { length: 500 }).notNull(),
    localeCode: varchar('locale_code', { length: 20 }),
    referrerDomain: varchar('referrer_domain', { length: 512 }),
    utmSource: varchar('utm_source', { length: 256 }),
    utmMedium: varchar('utm_medium', { length: 256 }),
    utmCampaign: varchar('utm_campaign', { length: 256 }),
    deviceType: varchar('device_type', { length: 32 }),
    browser: varchar('browser', { length: 64 }),
    operatingSystem: varchar('operating_system', { length: 64 }),
    viewportBucket: varchar('viewport_bucket', { length: 32 }),
    isBot: boolean('is_bot').notNull().default(false),
    createdAt: datetime('created_at', { fsp: 6, mode: 'date' })
      .notNull()
      .$defaultFn(() => new Date())
  },
  table => [
    uniqueIndex('analytics_events_event_id_key').on(table.eventId),
    index('analytics_events_session_idx').on(table.sessionKey, table.occurredAt),
    index('analytics_events_visitor_idx').on(table.visitorKey, table.occurredAt),
    index('analytics_events_path_idx').on(table.path, table.occurredAt),
    index('analytics_events_occurred_idx').on(table.occurredAt)
  ]
)

export const analyticsSessions = mysqlTable(
  'analytics_sessions',
  {
    id: bigint('id', { mode: 'number' }).notNull().autoincrement().primaryKey(),
    sessionKey: varchar('session_key', { length: 128 }).notNull(),
    visitorKey: varchar('visitor_key', { length: 128 }).notNull(),
    startedAt: datetime('started_at', { fsp: 6, mode: 'date' }).notNull(),
    lastSeenAt: datetime('last_seen_at', { fsp: 6, mode: 'date' }).notNull(),
    landingPath: varchar('landing_path', { length: 2048 }).notNull(),
    exitPath: varchar('exit_path', { length: 2048 }),
    source: varchar('source', { length: 128 }).notNull().default('direct'),
    medium: varchar('medium', { length: 128 }),
    campaign: varchar('campaign', { length: 256 }),
    localeCode: varchar('locale_code', { length: 20 }),
    deviceType: varchar('device_type', { length: 32 }),
    browser: varchar('browser', { length: 64 }),
    operatingSystem: varchar('operating_system', { length: 64 }),
    pageviews: int('pageviews').notNull().default(0),
    isBounce: boolean('is_bounce').notNull().default(true),
    isBot: boolean('is_bot').notNull().default(false),
    createdAt: datetime('created_at', { fsp: 6, mode: 'date' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: datetime('updated_at', { fsp: 6, mode: 'date' })
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdateFn(() => new Date())
  },
  table => [
    uniqueIndex('analytics_sessions_session_key_key').on(table.sessionKey),
    index('analytics_sessions_visitor_idx').on(table.visitorKey),
    index('analytics_sessions_started_idx').on(table.startedAt)
  ]
)
