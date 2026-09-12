import {
  text,
  bigint,
  boolean,
  timestamp,
  foreignKey,
  index,
  pgTable,
  uniqueIndex,
  varchar
} from 'drizzle-orm/pg-core'
import { locales } from './locales'
import { users } from './users'

/* Pages (architecture §9.2): static content pages. template belongs to
   the entity and is never translated; slug is unique per locale. */

export const pages = pgTable(
  'pages',
  {
    id: bigint('id', { mode: 'number' }).notNull().generatedByDefaultAsIdentity().primaryKey(),
    /* stable public URL identifier, locale-independent (alias unification doc 2.1) */
    alias: varchar('alias', { length: 120 }).notNull(),
    primaryLocaleId: bigint('primary_locale_id', { mode: 'number' }).notNull(),
    authorId: bigint('author_id', { mode: 'number' }).notNull(),
    // default | landing | contact ... theme-selectable, machine key
    template: varchar('template', { length: 40 }).notNull().default('default'),
    status: varchar('status', { length: 20 }).notNull().default('draft'),
    publishedAt: timestamp('published_at', { withTimezone: true, mode: 'date' }),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'date' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdateFn(() => new Date())
  },
  table => [
    index('pages_status_idx').on(table.status),
    index('pages_author_idx').on(table.authorId),
    foreignKey({
      name: 'pages_primary_locale_id_fk',
      columns: [table.primaryLocaleId],
      foreignColumns: [locales.id]
    }),
    foreignKey({
      name: 'pages_author_id_fk',
      columns: [table.authorId],
      foreignColumns: [users.id]
    })
  ]
)

export const pageTranslations = pgTable(
  'page_translations',
  {
    id: bigint('id', { mode: 'number' }).notNull().generatedByDefaultAsIdentity().primaryKey(),
    pageId: bigint('page_id', { mode: 'number' }).notNull(),
    localeId: bigint('locale_id', { mode: 'number' }).notNull(),
    title: varchar('title', { length: 255 }).notNull(),
    content: text('content').notNull(),
    seoTitle: varchar('seo_title', { length: 255 }).notNull().default(''),
    seoDescription: varchar('seo_description', { length: 500 }).notNull().default(''),
    canonicalUrl: varchar('canonical_url', { length: 500 }),
    noindex: boolean('noindex').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdateFn(() => new Date())
  },
  table => [
    uniqueIndex('page_translations_page_locale_key').on(table.pageId, table.localeId),
    index('page_translations_locale_idx').on(table.localeId),
    foreignKey({
      name: 'page_translations_page_id_fk',
      columns: [table.pageId],
      foreignColumns: [pages.id]
    }).onDelete('cascade'),
    foreignKey({
      name: 'page_translations_locale_id_fk',
      columns: [table.localeId],
      foreignColumns: [locales.id]
    }).onDelete('cascade')
  ]
)
