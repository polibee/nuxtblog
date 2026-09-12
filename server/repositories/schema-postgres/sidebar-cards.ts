import {
  text,
  bigint,
  boolean,
  timestamp,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  uniqueIndex,
  varchar
} from 'drizzle-orm/pg-core'
import { locales } from './locales'

/* Public-site sidebar cards (Entity + Translation, architecture §8.3):
   machine fields live on the entity, natural-language title/content
   go to the translation table keyed by card + locale. */

export const sidebarCards = pgTable(
  'sidebar_cards',
  {
    id: bigint('id', { mode: 'number' }).notNull().generatedByDefaultAsIdentity().primaryKey(),
    type: varchar('type', { length: 32 }).notNull().default('html'),
    /* typed-card fields: html card uses content; link/image/js use these */
    linkUrl: varchar('link_url', { length: 500 }),
    imageMediaId: bigint('image_media_id', { mode: 'number' }),
    /* P27: type-specific config JSON (author card etc.) — never edited as JSON */
    config: jsonb('config'),
    enabled: boolean('enabled').notNull().default(true),
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
    index('sidebar_cards_enabled_idx').on(table.enabled),
    index('sidebar_cards_sort_idx').on(table.sortOrder)
  ]
)

export const sidebarCardTranslations = pgTable(
  'sidebar_card_translations',
  {
    id: bigint('id', { mode: 'number' }).notNull().generatedByDefaultAsIdentity().primaryKey(),
    cardId: bigint('card_id', { mode: 'number' }).notNull(),
    localeId: bigint('locale_id', { mode: 'number' }).notNull(),
    title: varchar('title', { length: 200 }).notNull(),
    content: text('content').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdateFn(() => new Date())
  },
  table => [
    uniqueIndex('sidebar_card_translations_card_locale_key').on(table.cardId, table.localeId),
    index('sidebar_card_translations_locale_idx').on(table.localeId),
    foreignKey({
      name: 'sidebar_card_translations_card_id_fk',
      columns: [table.cardId],
      foreignColumns: [sidebarCards.id]
    }).onDelete('cascade'),
    foreignKey({
      name: 'sidebar_card_translations_locale_id_fk',
      columns: [table.localeId],
      foreignColumns: [locales.id]
    }).onDelete('cascade')
  ]
)
