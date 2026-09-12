import {
  bigint,
  boolean,
  timestamp,
  index,
  integer,
  pgTable,
  uniqueIndex,
  varchar
} from 'drizzle-orm/pg-core'

/* P19 slider module: sliders (carousel config, UNIQUE key like 'home.hero')
   + slider_items (one slide: images/link/schedule/sort) + per-locale
   slide copy. Desktop aspect 16:7 / mobile 4:3 are frontend constants. */

export const sliders = pgTable(
  'sliders',
  {
    id: bigint('id', { mode: 'number' }).notNull().generatedByDefaultAsIdentity().primaryKey(),
    key: varchar('key', { length: 100 }).notNull(),
    name: varchar('name', { length: 120 }).notNull(),
    enabled: boolean('enabled').notNull().default(true),
    autoplay: boolean('autoplay').notNull().default(true),
    intervalMs: integer('interval_ms').notNull().default(5000),
    transition: varchar('transition', { length: 20 }).notNull().default('slide'),
    showArrows: boolean('show_arrows').notNull().default(true),
    showIndicators: boolean('show_indicators').notNull().default(true),
    pauseOnHover: boolean('pause_on_hover').notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdateFn(() => new Date())
  },
  table => [
    uniqueIndex('sliders_key_key').on(table.key)
  ]
)

export const sliderItems = pgTable(
  'slider_items',
  {
    id: bigint('id', { mode: 'number' }).notNull().generatedByDefaultAsIdentity().primaryKey(),
    sliderId: bigint('slider_id', { mode: 'number' }).notNull(),
    imageMediaId: bigint('image_media_id', { mode: 'number' }).notNull(),
    mobileImageMediaId: bigint('mobile_image_media_id', { mode: 'number' }),
    linkUrl: varchar('link_url', { length: 500 }),
    linkTarget: varchar('link_target', { length: 10 }).notNull().default('self'),
    enabled: boolean('enabled').notNull().default(true),
    startsAt: timestamp('starts_at', { withTimezone: true, mode: 'date' }),
    endsAt: timestamp('ends_at', { withTimezone: true, mode: 'date' }),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdateFn(() => new Date())
  },
  table => [
    index('slider_items_slider_idx').on(table.sliderId, table.sortOrder)
  ]
)

export const sliderItemTranslations = pgTable(
  'slider_item_translations',
  {
    id: bigint('id', { mode: 'number' }).notNull().generatedByDefaultAsIdentity().primaryKey(),
    sliderItemId: bigint('slider_item_id', { mode: 'number' }).notNull(),
    localeId: integer('locale_id').notNull(),
    title: varchar('title', { length: 200 }),
    description: varchar('description', { length: 500 }),
    buttonText: varchar('button_text', { length: 50 }),
    linkUrl: varchar('link_url', { length: 500 }),
    altText: varchar('alt_text', { length: 300 }).notNull().default(''),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdateFn(() => new Date())
  },
  table => [
    uniqueIndex('slider_item_translations_item_locale_key').on(table.sliderItemId, table.localeId)
  ]
)
