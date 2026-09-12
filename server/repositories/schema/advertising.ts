import {
  bigint,
  boolean,
  datetime,
  index,
  int,
  mediumtext,
  mysqlTable,
  uniqueIndex,
  varchar
} from 'drizzle-orm/mysql-core'

/* P17 advertising: slots (page placeholders), placements (slot↔campaign),
   campaigns, creatives with per-locale translations. membership_plans
   features column carries ["ad_free"] for the Decision Service. */

export const adSlots = mysqlTable(
  'ad_slots',
  {
    id: bigint('id', { mode: 'number' }).notNull().autoincrement().primaryKey(),
    key: varchar('key', { length: 60 }).notNull(),
    name: varchar('name', { length: 120 }).notNull(),
    enabled: boolean('enabled').notNull().default(true),
    createdAt: datetime('created_at', { fsp: 6, mode: 'date' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: datetime('updated_at', { fsp: 6, mode: 'date' })
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdateFn(() => new Date())
  },
  table => [
    uniqueIndex('ad_slots_key_key').on(table.key)
  ]
)

export const adCampaigns = mysqlTable(
  'ad_campaigns',
  {
    id: bigint('id', { mode: 'number' }).notNull().autoincrement().primaryKey(),
    name: varchar('name', { length: 120 }).notNull(),
    status: varchar('status', { length: 20 }).notNull().default('draft'),
    startAt: datetime('start_at', { fsp: 6, mode: 'date' }),
    endAt: datetime('end_at', { fsp: 6, mode: 'date' }),
    /* P21 ad purchase: campaigns are bought through the standard
       order/payment chain via the ad-{id} shadow product */
    budgetMinor: bigint('budget_minor', { mode: 'number' }).notNull().default(0),
    currency: varchar('currency', { length: 8 }).notNull().default('USD'),
    paidAmountMinor: bigint('paid_amount_minor', { mode: 'number' }).notNull().default(0),
    orderId: bigint('order_id', { mode: 'number' }),
    paidAt: datetime('paid_at', { fsp: 6, mode: 'date' }),
    /* P22 self-serve application materials + review */
    materialTitle: varchar('material_title', { length: 200 }),
    materialDescription: varchar('material_description', { length: 500 }),
    materialImageMediaId: bigint('material_image_media_id', { mode: 'number' }),
    materialUrl: varchar('material_url', { length: 500 }),
    materialSlotKey: varchar('material_slot_key', { length: 60 }),
    contactEmail: varchar('contact_email', { length: 255 }),
    reviewNote: varchar('review_note', { length: 500 }),
    createdAt: datetime('created_at', { fsp: 6, mode: 'date' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: datetime('updated_at', { fsp: 6, mode: 'date' })
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdateFn(() => new Date())
  }
)

export const adCreatives = mysqlTable(
  'ad_creatives',
  {
    id: bigint('id', { mode: 'number' }).notNull().autoincrement().primaryKey(),
    campaignId: bigint('campaign_id', { mode: 'number' }).notNull(),
    provider: varchar('provider', { length: 30 }).notNull().default('image'),
    weight: int('weight').notNull().default(1),
    impressions: int('impressions').notNull().default(0),
    clicks: int('clicks').notNull().default(0),
    enabled: boolean('enabled').notNull().default(true),
    createdAt: datetime('created_at', { fsp: 6, mode: 'date' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: datetime('updated_at', { fsp: 6, mode: 'date' })
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdateFn(() => new Date())
  },
  table => [
    index('ad_creatives_campaign_idx').on(table.campaignId)
  ]
)

export const adCreativeTranslations = mysqlTable(
  'ad_creative_translations',
  {
    id: bigint('id', { mode: 'number' }).notNull().autoincrement().primaryKey(),
    creativeId: bigint('creative_id', { mode: 'number' }).notNull(),
    localeId: bigint('locale_id', { mode: 'number' }).notNull(),
    title: varchar('title', { length: 200 }).notNull(),
    content: mediumtext('content'),
    buttonText: varchar('button_text', { length: 100 }),
    imageId: bigint('image_id', { mode: 'number' }),
    targetUrl: varchar('target_url', { length: 500 }),
    altText: varchar('alt_text', { length: 200 }),
    createdAt: datetime('created_at', { fsp: 6, mode: 'date' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: datetime('updated_at', { fsp: 6, mode: 'date' })
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdateFn(() => new Date())
  },
  table => [
    uniqueIndex('ad_creative_translations_creative_locale_key').on(table.creativeId, table.localeId)
  ]
)

export const adPlacements = mysqlTable(
  'ad_placements',
  {
    id: bigint('id', { mode: 'number' }).notNull().autoincrement().primaryKey(),
    slotKey: varchar('slot_key', { length: 60 }).notNull(),
    campaignId: bigint('campaign_id', { mode: 'number' }).notNull(),
    priority: int('priority').notNull().default(0),
    enabled: boolean('enabled').notNull().default(true),
    createdAt: datetime('created_at', { fsp: 6, mode: 'date' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: datetime('updated_at', { fsp: 6, mode: 'date' })
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdateFn(() => new Date())
  },
  table => [
    index('ad_placements_slot_idx').on(table.slotKey, table.enabled)
  ]
)
