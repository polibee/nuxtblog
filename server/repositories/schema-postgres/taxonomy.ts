import {
  bigint,
  timestamp,
  foreignKey,
  index,
  pgTable,
  primaryKey,
  uniqueIndex,
  varchar
} from 'drizzle-orm/pg-core'
import { locales } from './locales'
import { posts } from './posts'

/* Taxonomy (categories/tags): entity carries no fields beyond identity;
   name/slug/description live in translations with per-locale slug
   uniqueness. Post relations bind entity ids, never translations. */

export const categories = pgTable('categories', {
  id: bigint('id', { mode: 'number' }).notNull().generatedByDefaultAsIdentity().primaryKey(),
  /* stable public URL identifier, locale-independent (alias unification doc 2.1) */
  alias: varchar('alias', { length: 120 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdateFn(() => new Date())
})

export const categoryTranslations = pgTable(
  'category_translations',
  {
    id: bigint('id', { mode: 'number' }).notNull().generatedByDefaultAsIdentity().primaryKey(),
    entityId: bigint('entity_id', { mode: 'number' }).notNull(),
    localeId: bigint('locale_id', { mode: 'number' }).notNull(),
    name: varchar('name', { length: 120 }).notNull(),
    description: varchar('description', { length: 500 }).notNull().default(''),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdateFn(() => new Date())
  },
  table => [
    uniqueIndex('category_translations_entity_locale_key').on(table.entityId, table.localeId),
    index('category_translations_locale_idx').on(table.localeId),
    foreignKey({
      name: 'category_translations_category_id_fk',
      columns: [table.entityId],
      foreignColumns: [categories.id]
    }).onDelete('cascade'),
    foreignKey({
      name: 'category_translations_locale_id_fk',
      columns: [table.localeId],
      foreignColumns: [locales.id]
    }).onDelete('cascade')
  ]
)

export const tags = pgTable('tags', {
  id: bigint('id', { mode: 'number' }).notNull().generatedByDefaultAsIdentity().primaryKey(),
  alias: varchar('alias', { length: 120 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdateFn(() => new Date())
})

export const tagTranslations = pgTable(
  'tag_translations',
  {
    id: bigint('id', { mode: 'number' }).notNull().generatedByDefaultAsIdentity().primaryKey(),
    entityId: bigint('entity_id', { mode: 'number' }).notNull(),
    localeId: bigint('locale_id', { mode: 'number' }).notNull(),
    name: varchar('name', { length: 120 }).notNull(),
    description: varchar('description', { length: 500 }).notNull().default(''),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdateFn(() => new Date())
  },
  table => [
    uniqueIndex('tag_translations_entity_locale_key').on(table.entityId, table.localeId),
    index('tag_translations_locale_idx').on(table.localeId),
    foreignKey({
      name: 'tag_translations_tag_id_fk',
      columns: [table.entityId],
      foreignColumns: [tags.id]
    }).onDelete('cascade'),
    foreignKey({
      name: 'tag_translations_locale_id_fk',
      columns: [table.localeId],
      foreignColumns: [locales.id]
    }).onDelete('cascade')
  ]
)

export const postCategories = pgTable(
  'post_categories',
  {
    postId: bigint('post_id', { mode: 'number' }).notNull(),
    categoryId: bigint('category_id', { mode: 'number' }).notNull()
  },
  table => [
    primaryKey({ columns: [table.postId, table.categoryId] }),
    index('post_categories_category_idx').on(table.categoryId),
    foreignKey({
      name: 'post_categories_post_id_fk',
      columns: [table.postId],
      foreignColumns: [posts.id]
    }).onDelete('cascade'),
    foreignKey({
      name: 'post_categories_category_id_fk',
      columns: [table.categoryId],
      foreignColumns: [categories.id]
    }).onDelete('cascade')
  ]
)

export const postTags = pgTable(
  'post_tags',
  {
    postId: bigint('post_id', { mode: 'number' }).notNull(),
    tagId: bigint('tag_id', { mode: 'number' }).notNull()
  },
  table => [
    primaryKey({ columns: [table.postId, table.tagId] }),
    index('post_tags_tag_idx').on(table.tagId),
    foreignKey({
      name: 'post_tags_post_id_fk',
      columns: [table.postId],
      foreignColumns: [posts.id]
    }).onDelete('cascade'),
    foreignKey({
      name: 'post_tags_tag_id_fk',
      columns: [table.tagId],
      foreignColumns: [tags.id]
    }).onDelete('cascade')
  ]
)
