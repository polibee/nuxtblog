import {
  bigint,
  boolean,
  datetime,
  foreignKey,
  index,
  int,
  mysqlTable,
  uniqueIndex,
  varchar
} from 'drizzle-orm/mysql-core'
import { users } from './users'

export const badges = mysqlTable('badges', {
  id: bigint('id', { mode: 'number' }).notNull().autoincrement().primaryKey(),
  key: varchar('key', { length: 60 }).notNull(),
  name: varchar('name', { length: 120 }).notNull(),
  description: varchar('description', { length: 500 }).notNull().default(''),
  icon: varchar('icon', { length: 60 }).notNull().default('badge'),
  color: varchar('color', { length: 30 }).notNull().default('blue'),
  sortOrder: int('sort_order').notNull().default(0),
  enabled: boolean('enabled').notNull().default(true),
  createdAt: datetime('created_at', { fsp: 6, mode: 'date' }).notNull().$defaultFn(() => new Date()),
  updatedAt: datetime('updated_at', { fsp: 6, mode: 'date' }).notNull().$defaultFn(() => new Date()).$onUpdateFn(() => new Date())
}, table => [uniqueIndex('badges_key_key').on(table.key)])

export const userBadges = mysqlTable('user_badges', {
  id: bigint('id', { mode: 'number' }).notNull().autoincrement().primaryKey(),
  userId: bigint('user_id', { mode: 'number' }).notNull(),
  badgeId: bigint('badge_id', { mode: 'number' }).notNull(),
  sourceType: varchar('source_type', { length: 40 }).notNull(),
  sourceId: bigint('source_id', { mode: 'number' }),
  expiresAt: datetime('expires_at', { fsp: 6, mode: 'date' }),
  grantedAt: datetime('granted_at', { fsp: 6, mode: 'date' }).notNull().$defaultFn(() => new Date())
}, table => [
  uniqueIndex('user_badges_user_badge_key').on(table.userId, table.badgeId),
  index('user_badges_user_idx').on(table.userId),
  index('user_badges_badge_idx').on(table.badgeId),
  foreignKey({ name: 'user_badges_user_id_fk', columns: [table.userId], foreignColumns: [users.id] }).onDelete('cascade'),
  foreignKey({ name: 'user_badges_badge_id_fk', columns: [table.badgeId], foreignColumns: [badges.id] }).onDelete('cascade')
])
