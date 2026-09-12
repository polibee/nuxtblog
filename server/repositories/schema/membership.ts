import {
  bigint,
  datetime,
  index,
  mysqlTable,
  uniqueIndex,
  varchar
} from 'drizzle-orm/mysql-core'

/* P15 membership: plans (entity + translations), user subscriptions,
   and per-post purchase grants for access_type='paid' posts. */

export const membershipPlans = mysqlTable(
  'membership_plans',
  {
    id: bigint('id', { mode: 'number' }).notNull().autoincrement().primaryKey(),
    alias: varchar('alias', { length: 120 }).notNull(),
    priceMinor: bigint('price_minor', { mode: 'number' }).notNull(),
    currency: varchar('currency', { length: 3 }).notNull(),
    period: varchar('period', { length: 20 }).notNull().default('month'),
    status: varchar('status', { length: 20 }).notNull().default('published'),
    /* machine feature flags, JSON array e.g. ["ad_free"] (architecture §9.3) */
    features: varchar('features', { length: 500 }),
    createdAt: datetime('created_at', { fsp: 6, mode: 'date' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: datetime('updated_at', { fsp: 6, mode: 'date' })
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdateFn(() => new Date())
  },
  table => [
    uniqueIndex('membership_plans_alias_key').on(table.alias)
  ]
)

export const membershipPlanTranslations = mysqlTable(
  'membership_plan_translations',
  {
    id: bigint('id', { mode: 'number' }).notNull().autoincrement().primaryKey(),
    entityId: bigint('entity_id', { mode: 'number' }).notNull(),
    localeId: bigint('locale_id', { mode: 'number' }).notNull(),
    name: varchar('name', { length: 120 }).notNull(),
    description: varchar('description', { length: 500 }),
    createdAt: datetime('created_at', { fsp: 6, mode: 'date' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: datetime('updated_at', { fsp: 6, mode: 'date' })
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdateFn(() => new Date())
  },
  table => [
    uniqueIndex('membership_plan_translations_entity_locale_key').on(table.entityId, table.localeId)
  ]
)

export const subscriptions = mysqlTable(
  'subscriptions',
  {
    id: bigint('id', { mode: 'number' }).notNull().autoincrement().primaryKey(),
    userId: bigint('user_id', { mode: 'number' }).notNull(),
    planId: bigint('plan_id', { mode: 'number' }).notNull(),
    status: varchar('status', { length: 20 }).notNull().default('active'),
    currentPeriodEnd: datetime('current_period_end', { fsp: 6, mode: 'date' }).notNull(),
    createdAt: datetime('created_at', { fsp: 6, mode: 'date' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: datetime('updated_at', { fsp: 6, mode: 'date' })
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdateFn(() => new Date())
  },
  table => [
    index('subscriptions_user_idx').on(table.userId, table.status)
  ]
)

export const postPurchases = mysqlTable(
  'post_purchases',
  {
    id: bigint('id', { mode: 'number' }).notNull().autoincrement().primaryKey(),
    postId: bigint('post_id', { mode: 'number' }).notNull(),
    orderId: bigint('order_id', { mode: 'number' }).notNull(),
    userId: bigint('user_id', { mode: 'number' }),
    email: varchar('email', { length: 255 }).notNull().default(''),
    purchasedAt: datetime('purchased_at', { fsp: 6, mode: 'date' }).notNull()
  },
  table => [
    index('post_purchases_post_idx').on(table.postId, table.email)
  ]
)
