import {
  bigint,
  datetime,
  foreignKey,
  index,
  mysqlTable,
  text,
  varchar
} from 'drizzle-orm/mysql-core'
import { posts } from './posts'
import { users } from './users'

/* Comments (architecture §7): guests or users comment on posts.
   Moderation: new comments land in 'pending' and only 'approved' ones
   render publicly. Nested replies via self-referencing parent_id. */

export const comments = mysqlTable(
  'comments',
  {
    id: bigint('id', { mode: 'number' }).notNull().autoincrement().primaryKey(),
    postId: bigint('post_id', { mode: 'number' }).notNull(),
    parentId: bigint('parent_id', { mode: 'number' }),
    userId: bigint('user_id', { mode: 'number' }),
    authorName: varchar('author_name', { length: 80 }).notNull(),
    authorEmail: varchar('author_email', { length: 255 }).notNull(),
    authorUrl: varchar('author_url', { length: 500 }),
    gravatarHash: varchar('gravatar_hash', { length: 32 }),
    browserName: varchar('browser_name', { length: 40 }),
    browserVersion: varchar('browser_version', { length: 40 }),
    osName: varchar('os_name', { length: 40 }),
    osVersion: varchar('os_version', { length: 40 }),
    deviceType: varchar('device_type', { length: 16 }),
    ipHash: varchar('ip_hash', { length: 64 }),
    content: text('content').notNull(),
    // pending | approved | spam
    status: varchar('status', { length: 20 }).notNull().default('pending'),
    moderationReason: varchar('moderation_reason', { length: 500 }),
    approvedAt: datetime('approved_at', { fsp: 6, mode: 'date' }),
    approvedBy: bigint('approved_by', { mode: 'number' }),
    createdAt: datetime('created_at', { fsp: 6, mode: 'date' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: datetime('updated_at', { fsp: 6, mode: 'date' })
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdateFn(() => new Date())
  },
  table => [
    index('comments_post_status_idx').on(table.postId, table.status),
    index('comments_parent_idx').on(table.parentId),
    index('comments_user_idx').on(table.userId),
    foreignKey({
      name: 'comments_post_id_fk',
      columns: [table.postId],
      foreignColumns: [posts.id]
    }).onDelete('cascade'),
    foreignKey({
      name: 'comments_parent_id_fk',
      columns: [table.parentId],
      foreignColumns: [table.id]
    }).onDelete('cascade'),
    foreignKey({
      name: 'comments_user_id_fk',
      columns: [table.userId],
      foreignColumns: [users.id]
    }).onDelete('set null'),
    foreignKey({
      name: 'comments_approved_by_fk',
      columns: [table.approvedBy],
      foreignColumns: [users.id]
    }).onDelete('set null')
  ]
)
