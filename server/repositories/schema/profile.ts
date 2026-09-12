import {
  bigint,
  boolean,
  datetime,
  index,
  int,
  json,
  mediumtext,
  mysqlTable,
  text,
  varchar
} from 'drizzle-orm/mysql-core'

/* P29 profile page + P30 AI assistant chat persistence. Author content
   tables are single-author (no author_id yet — doc reserves the column
   for the multi-author stage). */

export const authorProfile = mysqlTable('author_profile', {
  id: bigint('id', { mode: 'number' }).notNull().autoincrement().primaryKey(),
  displayName: varchar('display_name', { length: 80 }).notNull().default(''),
  headline: varchar('headline', { length: 120 }).notNull().default(''),
  bio: text('bio'),
  avatarMediaId: bigint('avatar_media_id', { mode: 'number' }),
  location: varchar('location', { length: 120 }).notNull().default(''),
  heroConfig: json('hero_config'),
  createdAt: datetime('created_at', { fsp: 6, mode: 'date' })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: datetime('updated_at', { fsp: 6, mode: 'date' })
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdateFn(() => new Date())
})

export const authorProfileTranslations = mysqlTable('author_profile_translations', {
  id: bigint('id', { mode: 'number' }).notNull().autoincrement().primaryKey(),
  profileId: bigint('profile_id', { mode: 'number' }).notNull(),
  localeId: bigint('locale_id', { mode: 'number' }).notNull(),
  displayName: varchar('display_name', { length: 80 }).notNull(),
  headline: varchar('headline', { length: 120 }).notNull().default(''),
  bio: text('bio'),
  location: varchar('location', { length: 120 }).notNull().default(''),
  updatedAt: datetime('updated_at', { fsp: 6, mode: 'date' }).notNull().$defaultFn(() => new Date()).$onUpdateFn(() => new Date())
}, table => [index('author_profile_translations_profile_locale_idx').on(table.profileId, table.localeId)])

export const authorSocialChannels = mysqlTable('author_social_channels', {
  id: bigint('id', { mode: 'number' }).notNull().autoincrement().primaryKey(),
  platform: varchar('platform', { length: 30 }).notNull(),
  url: varchar('url', { length: 500 }).notNull(),
  handle: varchar('handle', { length: 120 }).notNull().default(''),
  description: varchar('description', { length: 300 }).notNull().default(''),
  showInSidebar: boolean('show_in_sidebar').notNull().default(true),
  showInHero: boolean('show_in_hero').notNull().default(true),
  showInSocial: boolean('show_in_social').notNull().default(true),
  sortOrder: int('sort_order').notNull().default(0),
  createdAt: datetime('created_at', { fsp: 6, mode: 'date' })
    .notNull()
    .$defaultFn(() => new Date())
})

export const authorPageSections = mysqlTable('author_page_sections', {
  id: bigint('id', { mode: 'number' }).notNull().autoincrement().primaryKey(),
  type: varchar('type', { length: 40 }).notNull(),
  enabled: boolean('enabled').notNull().default(true),
  sortOrder: int('sort_order').notNull().default(0),
  config: json('config')
})

export const authorExperiences = mysqlTable('author_experiences', {
  id: bigint('id', { mode: 'number' }).notNull().autoincrement().primaryKey(),
  role: varchar('role', { length: 120 }).notNull(),
  organization: varchar('organization', { length: 120 }).notNull().default(''),
  period: varchar('period', { length: 60 }).notNull().default(''),
  current: boolean('current').notNull().default(false),
  location: varchar('location', { length: 120 }).notNull().default(''),
  description: text('description'),
  url: varchar('url', { length: 500 }),
  sortOrder: int('sort_order').notNull().default(0)
})

export const authorProjects = mysqlTable('author_projects', {
  id: bigint('id', { mode: 'number' }).notNull().autoincrement().primaryKey(),
  name: varchar('name', { length: 120 }).notNull(),
  description: text('description'),
  imageMediaId: bigint('image_media_id', { mode: 'number' }),
  url: varchar('url', { length: 500 }),
  githubUrl: varchar('github_url', { length: 500 }),
  tags: varchar('tags', { length: 300 }).notNull().default(''),
  featured: boolean('featured').notNull().default(false),
  sortOrder: int('sort_order').notNull().default(0)
})

export const authorSkills = mysqlTable('author_skills', {
  id: bigint('id', { mode: 'number' }).notNull().autoincrement().primaryKey(),
  groupName: varchar('group_name', { length: 60 }).notNull().default(''),
  name: varchar('name', { length: 80 }).notNull(),
  sortOrder: int('sort_order').notNull().default(0)
})

export const authorEducation = mysqlTable('author_education', {
  id: bigint('id', { mode: 'number' }).notNull().autoincrement().primaryKey(),
  school: varchar('school', { length: 120 }).notNull(),
  program: varchar('program', { length: 120 }).notNull().default(''),
  period: varchar('period', { length: 60 }).notNull().default(''),
  details: varchar('details', { length: 500 }).notNull().default(''),
  sortOrder: int('sort_order').notNull().default(0)
})

export const authorCertifications = mysqlTable('author_certifications', {
  id: bigint('id', { mode: 'number' }).notNull().autoincrement().primaryKey(),
  name: varchar('name', { length: 120 }).notNull(),
  issuer: varchar('issuer', { length: 120 }).notNull().default(''),
  dateIssued: varchar('date_issued', { length: 40 }).notNull().default(''),
  url: varchar('url', { length: 500 }),
  sortOrder: int('sort_order').notNull().default(0)
})

export const authorFocusItems = mysqlTable('author_focus_items', {
  id: bigint('id', { mode: 'number' }).notNull().autoincrement().primaryKey(),
  text: varchar('text', { length: 200 }).notNull(),
  sortOrder: int('sort_order').notNull().default(0)
})

export const aiConversations = mysqlTable(
  'ai_conversations',
  {
    id: bigint('id', { mode: 'number' }).notNull().autoincrement().primaryKey(),
    userId: bigint('user_id', { mode: 'number' }),
    title: varchar('title', { length: 120 }).notNull().default(''),
    scopeType: varchar('scope_type', { length: 30 }).notNull().default('site'),
    /* P31 conversation compression (§24/25): deterministic summary of
       older messages + the message id it covers */
    summaryText: mediumtext('summary_text'),
    summaryUntilMessageId: bigint('summary_until_message_id', { mode: 'number' }),
    createdAt: datetime('created_at', { fsp: 6, mode: 'date' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: datetime('updated_at', { fsp: 6, mode: 'date' })
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdateFn(() => new Date())
  },
  table => [index('ai_conversations_user_idx').on(table.userId, table.updatedAt)]
)

export const aiMessages = mysqlTable(
  'ai_messages',
  {
    id: bigint('id', { mode: 'number' }).notNull().autoincrement().primaryKey(),
    conversationId: bigint('conversation_id', { mode: 'number' }).notNull(),
    role: varchar('role', { length: 20 }).notNull(),
    content: mediumtext('content').notNull(),
    referencesJson: mediumtext('references_json'),
    createdAt: datetime('created_at', { fsp: 6, mode: 'date' })
      .notNull()
      .$defaultFn(() => new Date())
  },
  table => [index('ai_messages_conversation_idx').on(table.conversationId, table.id)]
)

export const aiToolCalls = mysqlTable(
  'ai_tool_calls',
  {
    id: bigint('id', { mode: 'number' }).notNull().autoincrement().primaryKey(),
    conversationId: bigint('conversation_id', { mode: 'number' }).notNull(),
    tool: varchar('tool', { length: 80 }).notNull(),
    status: varchar('status', { length: 20 }).notNull().default('ok'),
    durationMs: int('duration_ms'),
    createdAt: datetime('created_at', { fsp: 6, mode: 'date' })
      .notNull()
      .$defaultFn(() => new Date())
  },
  table => [index('ai_tool_calls_conversation_idx').on(table.conversationId)]
)
