import {
  text,
  bigint,
  boolean,
  timestamp,
  index,
  integer,
  pgTable,
  uniqueIndex,
  varchar
} from 'drizzle-orm/pg-core'

/* P37 Friend Links / Blogroll (docs/友链.txt §9/12/66/79/81): the page
   itself is a normal Page (template=friend_links); this module owns the
   DATA. Submissions live in their own table — spam never mixes with
   the live list (§11). */

export const friendLinkCategories = pgTable(
  'friend_link_categories',
  {
    id: bigint('id', { mode: 'number' }).notNull().generatedByDefaultAsIdentity().primaryKey(),
    slug: varchar('slug', { length: 60 }).notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .$defaultFn(() => new Date())
  },
  table => [uniqueIndex('friend_link_categories_slug_idx').on(table.slug)]
)

export const friendLinkCategoryTranslations = pgTable(
  'friend_link_category_translations',
  {
    id: bigint('id', { mode: 'number' }).notNull().generatedByDefaultAsIdentity().primaryKey(),
    categoryId: bigint('category_id', { mode: 'number' }).notNull(),
    localeId: bigint('locale_id', { mode: 'number' }).notNull(),
    name: varchar('name', { length: 60 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .$defaultFn(() => new Date())
  },
  table => [
    uniqueIndex('friend_link_cat_tr_key').on(table.categoryId, table.localeId),
    index('friend_link_cat_tr_locale_idx').on(table.localeId)
  ]
)

export const friendLinks = pgTable(
  'friend_links',
  {
    id: bigint('id', { mode: 'number' }).notNull().generatedByDefaultAsIdentity().primaryKey(),
    name: varchar('name', { length: 120 }).notNull(),
    url: varchar('url', { length: 500 }).notNull(),
    /* scheme://host/ normalized (§46) */
    normalizedUrl: varchar('normalized_url', { length: 500 }).notNull(),
    domain: varchar('domain', { length: 200 }).notNull(),
    description: varchar('description', { length: 500 }).notNull().default(''),
    logoMediaId: bigint('logo_media_id', { mode: 'number' }),
    externalLogoUrl: varchar('external_logo_url', { length: 500 }),
    categoryId: bigint('category_id', { mode: 'number' }),
    /* active | disabled | broken | removed (§10) */
    status: varchar('status', { length: 20 }).notNull().default('active'),
    featured: boolean('featured').notNull().default(false),
    sortOrder: integer('sort_order').notNull().default(0),
    backlinkRequired: boolean('backlink_required').notNull().default(false),
    /* unknown | found | not_found | unreachable | blocked | error (§24) */
    backlinkStatus: varchar('backlink_status', { length: 20 }).notNull().default('unknown'),
    backlinkUrl: varchar('backlink_url', { length: 500 }),
    backlinkLastCheckedAt: timestamp('backlink_last_checked_at', { withTimezone: true, mode: 'date' }),
    backlinkLastFoundAt: timestamp('backlink_last_found_at', { withTimezone: true, mode: 'date' }),
    backlinkFailureCount: integer('backlink_failure_count').notNull().default(0),
    nofollow: boolean('nofollow').notNull().default(false),
    openInNewTab: boolean('open_in_new_tab').notNull().default(true),
    /* admin | submission */
    source: varchar('source', { length: 20 }).notNull().default('admin'),
    submissionId: bigint('submission_id', { mode: 'number' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdateFn(() => new Date()),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'date' })
  },
  table => [
    index('friend_links_status_idx').on(table.status, table.sortOrder),
    index('friend_links_domain_idx').on(table.domain)
  ]
)

export const friendLinkSubmissions = pgTable(
  'friend_link_submissions',
  {
    id: bigint('id', { mode: 'number' }).notNull().generatedByDefaultAsIdentity().primaryKey(),
    siteName: varchar('site_name', { length: 120 }).notNull(),
    siteUrl: varchar('site_url', { length: 500 }).notNull(),
    normalizedUrl: varchar('normalized_url', { length: 500 }).notNull(),
    domain: varchar('domain', { length: 200 }).notNull(),
    description: varchar('description', { length: 500 }).notNull().default(''),
    logoUrl: varchar('logo_url', { length: 500 }),
    contactName: varchar('contact_name', { length: 80 }),
    contactEmail: varchar('contact_email', { length: 200 }),
    backlinkUrl: varchar('backlink_url', { length: 500 }),
    /* pending | reviewing | approved | rejected | spam (§13) */
    status: varchar('status', { length: 20 }).notNull().default('pending'),
    backlinkStatus: varchar('backlink_status', { length: 20 }).notNull().default('unknown'),
    backlinkCheckedAt: timestamp('backlink_checked_at', { withTimezone: true, mode: 'date' }),
    backlinkFoundUrl: varchar('backlink_found_url', { length: 500 }),
    /* unknown | online | unreachable | timeout | invalid_ssl | error (§36) */
    siteStatus: varchar('site_status', { length: 20 }).notNull().default('unknown'),
    siteHttpStatus: integer('site_http_status'),
    siteTitleDetected: varchar('site_title_detected', { length: 300 }),
    reviewerId: bigint('reviewer_id', { mode: 'number' }),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true, mode: 'date' }),
    rejectionReason: varchar('rejection_reason', { length: 300 }),
    adminNote: varchar('admin_note', { length: 500 }),
    submitIpHash: varchar('submit_ip_hash', { length: 64 }),
    userAgent: varchar('user_agent', { length: 300 }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdateFn(() => new Date())
  },
  table => [
    index('friend_link_subs_status_idx').on(table.status, table.createdAt),
    index('friend_link_subs_domain_idx').on(table.domain)
  ]
)

/* health check history (§81): regenerated monitoring data, pruned to
   90 days, NOT part of backups (§85) */
export const friendLinkChecks = pgTable(
  'friend_link_checks',
  {
    id: bigint('id', { mode: 'number' }).notNull().generatedByDefaultAsIdentity().primaryKey(),
    friendLinkId: bigint('friend_link_id', { mode: 'number' }).notNull(),
    /* site | backlink */
    checkType: varchar('check_type', { length: 20 }).notNull(),
    status: varchar('status', { length: 20 }).notNull(),
    httpStatus: integer('http_status'),
    foundUrl: varchar('found_url', { length: 500 }),
    detailsJson: text('details_json'),
    checkedAt: timestamp('checked_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .$defaultFn(() => new Date())
  },
  table => [index('friend_link_checks_link_idx').on(table.friendLinkId, table.checkedAt)]
)
