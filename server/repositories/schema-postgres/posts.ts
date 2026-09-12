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
import { media } from './media'
import { users } from './users'

/* Posts (architecture §9.1): machine/state fields on the entity,
   natural language + SEO in post_translations. Publishing requires a
   complete primary-locale translation; slug is unique per locale. */

export const posts = pgTable(
  'posts',
  {
    id: bigint('id', { mode: 'number' }).notNull().generatedByDefaultAsIdentity().primaryKey(),
    /* stable public URL identifier, locale-independent (alias unification doc 2.1) */
    alias: varchar('alias', { length: 120 }).notNull(),
    primaryLocaleId: bigint('primary_locale_id', { mode: 'number' }).notNull(),
    authorId: bigint('author_id', { mode: 'number' }).notNull(),
    featuredMediaId: bigint('featured_media_id', { mode: 'number' }),
    // public | members (members gated in P12 Paid Content)
    accessType: varchar('access_type', { length: 20 }).notNull().default('public'),
    /* paid posts: single-purchase price (access_type = 'paid') */
    paidPriceMinor: bigint('paid_price_minor', { mode: 'number' }),
    paidCurrency: varchar('paid_currency', { length: 3 }),
    // draft | scheduled | published | archived
    status: varchar('status', { length: 20 }).notNull().default('draft'),
    publishedAt: timestamp('published_at', { withTimezone: true, mode: 'date' }),
    scheduledAt: timestamp('scheduled_at', { withTimezone: true, mode: 'date' }),
    // open | closed (comments arrive in P07)
    commentStatus: varchar('comment_status', { length: 20 }).notNull().default('closed'),
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
    index('posts_status_idx').on(table.status),
    index('posts_published_at_idx').on(table.publishedAt),
    index('posts_author_idx').on(table.authorId),
    index('posts_primary_locale_idx').on(table.primaryLocaleId),
    foreignKey({
      name: 'posts_primary_locale_id_fk',
      columns: [table.primaryLocaleId],
      foreignColumns: [locales.id]
    }),
    foreignKey({
      name: 'posts_author_id_fk',
      columns: [table.authorId],
      foreignColumns: [users.id]
    }),
    foreignKey({
      name: 'posts_featured_media_id_fk',
      columns: [table.featuredMediaId],
      foreignColumns: [media.id]
    }).onDelete('set null')
  ]
)

export const postTranslations = pgTable(
  'post_translations',
  {
    id: bigint('id', { mode: 'number' }).notNull().generatedByDefaultAsIdentity().primaryKey(),
    postId: bigint('post_id', { mode: 'number' }).notNull(),
    localeId: bigint('locale_id', { mode: 'number' }).notNull(),
    title: varchar('title', { length: 255 }).notNull(),
    excerpt: varchar('excerpt', { length: 500 }).notNull().default(''),
    content: text('content').notNull(),
    seoTitle: varchar('seo_title', { length: 255 }).notNull().default(''),
    seoDescription: varchar('seo_description', { length: 500 }).notNull().default(''),
    canonicalUrl: varchar('canonical_url', { length: 500 }),
    noindex: boolean('noindex').notNull().default(false),
    featuredImageId: bigint('featured_image_id', { mode: 'number' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdateFn(() => new Date())
  },
  table => [
    uniqueIndex('post_translations_post_locale_key').on(table.postId, table.localeId),
    index('post_translations_locale_idx').on(table.localeId),
    foreignKey({
      name: 'post_translations_post_id_fk',
      columns: [table.postId],
      foreignColumns: [posts.id]
    }).onDelete('cascade'),
    foreignKey({
      name: 'post_translations_locale_id_fk',
      columns: [table.localeId],
      foreignColumns: [locales.id]
    }).onDelete('cascade'),
    foreignKey({
      name: 'post_translations_featured_image_id_fk',
      columns: [table.featuredImageId],
      foreignColumns: [media.id]
    }).onDelete('set null')
  ]
)
