import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  varchar
} from 'drizzle-orm/pg-core'

export const locales = pgTable('locales', {
  id: bigint('id', { mode: 'number' }).generatedByDefaultAsIdentity().primaryKey(),
  code: varchar('code', { length: 20 }).notNull(),
  name: varchar('name', { length: 80 }).notNull(),
  nativeName: varchar('native_name', { length: 80 }).notNull(),
  urlPrefix: varchar('url_prefix', { length: 20 }),
  enabled: boolean('enabled').notNull().default(true),
  contentEnabled: boolean('content_enabled').notNull().default(false),
  uiEnabled: boolean('ui_enabled').notNull().default(false),
  isDefault: boolean('is_default').notNull().default(false),
  fallbackLocaleId: bigint('fallback_locale_id', { mode: 'number' }),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
}, table => [
  uniqueIndex('locales_code_key').on(table.code),
  uniqueIndex('locales_url_prefix_key').on(table.urlPrefix),
  index('locales_enabled_idx').on(table.enabled),
  index('locales_sort_idx').on(table.sortOrder)
])

export const users = pgTable('users', {
  id: bigint('id', { mode: 'number' }).generatedByDefaultAsIdentity().primaryKey(),
  name: varchar('name', { length: 120 }).notNull(),
  email: varchar('email', { length: 255 }).notNull(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
}, table => [uniqueIndex('users_email_key').on(table.email)])

export const pages = pgTable('pages', {
  id: bigint('id', { mode: 'number' }).generatedByDefaultAsIdentity().primaryKey(),
  alias: varchar('alias', { length: 120 }).notNull(),
  primaryLocaleId: bigint('primary_locale_id', { mode: 'number' }).notNull(),
  authorId: bigint('author_id', { mode: 'number' }).notNull(),
  template: varchar('template', { length: 40 }).notNull().default('default'),
  status: varchar('status', { length: 20 }).notNull().default('draft'),
  publishedAt: timestamp('published_at', { withTimezone: true }),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
}, table => [index('pages_status_idx').on(table.status), index('pages_alias_idx').on(table.alias)])

export const pageTranslations = pgTable('page_translations', {
  id: bigint('id', { mode: 'number' }).generatedByDefaultAsIdentity().primaryKey(),
  pageId: bigint('page_id', { mode: 'number' }).notNull(),
  localeId: bigint('locale_id', { mode: 'number' }).notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  content: text('content').notNull(),
  seoTitle: varchar('seo_title', { length: 255 }).notNull().default(''),
  seoDescription: varchar('seo_description', { length: 500 }).notNull().default(''),
  canonicalUrl: varchar('canonical_url', { length: 500 }),
  noindex: boolean('noindex').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
}, table => [uniqueIndex('page_translations_page_locale_key').on(table.pageId, table.localeId)])

export const posts = pgTable('posts', {
  id: bigint('id', { mode: 'number' }).generatedByDefaultAsIdentity().primaryKey(),
  alias: varchar('alias', { length: 120 }).notNull(),
  primaryLocaleId: bigint('primary_locale_id', { mode: 'number' }).notNull(),
  authorId: bigint('author_id', { mode: 'number' }).notNull(),
  featuredMediaId: bigint('featured_media_id', { mode: 'number' }),
  accessType: varchar('access_type', { length: 20 }).notNull().default('public'),
  paidPriceMinor: bigint('paid_price_minor', { mode: 'number' }),
  paidCurrency: varchar('paid_currency', { length: 3 }),
  status: varchar('status', { length: 20 }).notNull().default('draft'),
  publishedAt: timestamp('published_at', { withTimezone: true }),
  scheduledAt: timestamp('scheduled_at', { withTimezone: true }),
  commentStatus: varchar('comment_status', { length: 20 }).notNull().default('closed'),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
}, table => [index('posts_status_idx').on(table.status), index('posts_alias_idx').on(table.alias)])

export const postTranslations = pgTable('post_translations', {
  id: bigint('id', { mode: 'number' }).generatedByDefaultAsIdentity().primaryKey(),
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
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
}, table => [uniqueIndex('post_translations_post_locale_key').on(table.postId, table.localeId), index('post_translations_locale_idx').on(table.localeId)])

export const authorProfile = pgTable('author_profile', {
  id: bigint('id', { mode: 'number' }).generatedByDefaultAsIdentity().primaryKey(),
  avatarMediaId: bigint('avatar_media_id', { mode: 'number' }),
  heroConfig: jsonb('hero_config'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
})

export const authorProfileTranslations = pgTable('author_profile_translations', {
  id: bigint('id', { mode: 'number' }).generatedByDefaultAsIdentity().primaryKey(),
  profileId: bigint('profile_id', { mode: 'number' }).notNull(),
  localeId: bigint('locale_id', { mode: 'number' }).notNull(),
  displayName: varchar('display_name', { length: 80 }).notNull(),
  headline: varchar('headline', { length: 120 }).notNull().default(''),
  bio: text('bio'),
  location: varchar('location', { length: 120 }).notNull().default(''),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
}, table => [uniqueIndex('author_profile_translations_profile_locale_key').on(table.profileId, table.localeId)])

export const urlRedirects = pgTable('url_redirects', {
  id: bigint('id', { mode: 'number' }).generatedByDefaultAsIdentity().primaryKey(),
  entityType: varchar('entity_type', { length: 20 }).notNull(),
  entityId: bigint('entity_id', { mode: 'number' }).notNull(),
  localeId: bigint('locale_id', { mode: 'number' }),
  oldPath: varchar('old_path', { length: 500 }).notNull(),
  newPath: varchar('new_path', { length: 500 }).notNull(),
  statusCode: integer('status_code').notNull().default(301),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true })
}, table => [uniqueIndex('url_redirects_old_path_key').on(table.oldPath), index('url_redirects_old_path_idx').on(table.oldPath)])

export const settings = pgTable('settings', {
  id: bigint('id', { mode: 'number' }).generatedByDefaultAsIdentity().primaryKey(),
  key: varchar('key', { length: 80 }).notNull(),
  value: text('value').notNull(),
  type: varchar('type', { length: 20 }).notNull().default('string'),
  group: varchar('group', { length: 40 }).notNull().default('General'),
  publicFlag: boolean('is_public').notNull().default(false),
  description: varchar('description', { length: 255 }),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
}, table => [uniqueIndex('settings_key_key').on(table.key), index('settings_group_idx').on(table.group)])

export const localizedSettings = pgTable('localized_settings', {
  id: bigint('id', { mode: 'number' }).generatedByDefaultAsIdentity().primaryKey(),
  key: varchar('key', { length: 80 }).notNull(),
  localeId: bigint('locale_id', { mode: 'number' }).notNull(),
  value: text('value').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
}, table => [uniqueIndex('localized_settings_key_locale_key').on(table.key, table.localeId), index('localized_settings_locale_idx').on(table.localeId)])

export const corePostgresSchema = {
  locales, users, pages, pageTranslations, posts, postTranslations,
  authorProfile, authorProfileTranslations, urlRedirects, settings, localizedSettings
}
