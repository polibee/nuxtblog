import {
  bigint,
  timestamp,
  index,
  pgTable,
  uniqueIndex,
  varchar
} from 'drizzle-orm/pg-core'

/* P15 membership: plans (entity + translations), user subscriptions,
   and per-post purchase grants for access_type='paid' posts. */

export const membershipPlans = pgTable(
  'membership_plans',
  {
    id: bigint('id', { mode: 'number' }).notNull().generatedByDefaultAsIdentity().primaryKey(),
    alias: varchar('alias', { length: 120 }).notNull(),
    priceMinor: bigint('price_minor', { mode: 'number' }).notNull(),
    currency: varchar('currency', { length: 3 }).notNull(),
    period: varchar('period', { length: 20 }).notNull().default('month'),
    status: varchar('status', { length: 20 }).notNull().default('published'),
    /* machine feature flags, JSON array e.g. ["ad_free"] (architecture §9.3) */
    features: varchar('features', { length: 500 }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdateFn(() => new Date())
  },
  table => [
    uniqueIndex('membership_plans_alias_key').on(table.alias)
  ]
)

export const membershipPlanTranslations = pgTable(
  'membership_plan_translations',
  {
    id: bigint('id', { mode: 'number' }).notNull().generatedByDefaultAsIdentity().primaryKey(),
    entityId: bigint('entity_id', { mode: 'number' }).notNull(),
    localeId: bigint('locale_id', { mode: 'number' }).notNull(),
    name: varchar('name', { length: 120 }).notNull(),
    description: varchar('description', { length: 500 }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdateFn(() => new Date())
  },
  table => [
    uniqueIndex('membership_plan_translations_entity_locale_key').on(table.entityId, table.localeId)
  ]
)

export const subscriptions = pgTable(
  'subscriptions',
  {
    id: bigint('id', { mode: 'number' }).notNull().generatedByDefaultAsIdentity().primaryKey(),
    userId: bigint('user_id', { mode: 'number' }).notNull(),
    planId: bigint('plan_id', { mode: 'number' }).notNull(),
    status: varchar('status', { length: 20 }).notNull().default('active'),
    currentPeriodEnd: timestamp('current_period_end', { withTimezone: true, mode: 'date' }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdateFn(() => new Date())
  },
  table => [
    index('subscriptions_user_idx').on(table.userId, table.status)
  ]
)

export const postPurchases = pgTable(
  'post_purchases',
  {
    id: bigint('id', { mode: 'number' }).notNull().generatedByDefaultAsIdentity().primaryKey(),
    postId: bigint('post_id', { mode: 'number' }).notNull(),
    orderId: bigint('order_id', { mode: 'number' }).notNull(),
    userId: bigint('user_id', { mode: 'number' }),
    email: varchar('email', { length: 255 }).notNull().default(''),
    purchasedAt: timestamp('purchased_at', { withTimezone: true, mode: 'date' }).notNull()
  },
  table => [
    index('post_purchases_post_idx').on(table.postId, table.email)
  ]
)
