import {
  bigint,
  datetime,
  foreignKey,
  index,
  mediumtext,
  mysqlTable,
  uniqueIndex,
  varchar
} from 'drizzle-orm/mysql-core'
import { sidebarCards } from './sidebar-cards'
import { locales } from './locales'

/** Localized copy for the singleton sidebar author card. Visual fields and
 * links stay on sidebar_cards.config and are intentionally not duplicated. */
export const authorCardTranslations = mysqlTable('author_card_translations', {
  id: bigint('id', { mode: 'number' }).notNull().autoincrement().primaryKey(),
  cardId: bigint('card_id', { mode: 'number' }).notNull(),
  localeId: bigint('locale_id', { mode: 'number' }).notNull(),
  displayName: varchar('display_name', { length: 50 }).notNull(),
  headline: varchar('headline', { length: 80 }).notNull().default(''),
  bio: mediumtext('bio').notNull(),
  ctaLabel: varchar('cta_label', { length: 30 }).notNull().default(''),
  createdAt: datetime('created_at', { fsp: 6, mode: 'date' }).notNull().$defaultFn(() => new Date()),
  updatedAt: datetime('updated_at', { fsp: 6, mode: 'date' }).notNull().$defaultFn(() => new Date()).$onUpdateFn(() => new Date())
}, table => [
  uniqueIndex('author_card_translations_card_locale_key').on(table.cardId, table.localeId),
  index('author_card_translations_locale_idx').on(table.localeId),
  index('author_card_translations_card_idx').on(table.cardId),
  foreignKey({
    name: 'author_card_translations_card_id_fk',
    columns: [table.cardId],
    foreignColumns: [sidebarCards.id]
  }).onDelete('cascade'),
  foreignKey({
    name: 'author_card_translations_locale_id_fk',
    columns: [table.localeId],
    foreignColumns: [locales.id]
  }).onDelete('cascade')
])

export { sidebarCards, locales }
