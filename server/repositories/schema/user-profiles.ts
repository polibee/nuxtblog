import { bigint, datetime, foreignKey, mysqlTable, text, varchar } from 'drizzle-orm/mysql-core'
import { users } from './users'

export const userProfiles = mysqlTable('user_profiles', {
  userId: bigint('user_id', { mode: 'number' }).notNull().primaryKey(),
  websiteUrl: varchar('website_url', { length: 500 }),
  bio: text('bio').notNull().default(''),
  avatarMediaId: bigint('avatar_media_id', { mode: 'number' }),
  createdAt: datetime('created_at', { fsp: 6, mode: 'date' }).notNull().$defaultFn(() => new Date()),
  updatedAt: datetime('updated_at', { fsp: 6, mode: 'date' }).notNull().$defaultFn(() => new Date()).$onUpdateFn(() => new Date())
}, table => [
  foreignKey({
    name: 'user_profiles_user_id_fk',
    columns: [table.userId],
    foreignColumns: [users.id]
  }).onDelete('cascade')
])

export const userPreferences = mysqlTable('user_preferences', {
  userId: bigint('user_id', { mode: 'number' }).notNull().primaryKey(),
  locale: varchar('locale', { length: 20 }).notNull().default('zh-CN'),
  timezone: varchar('timezone', { length: 64 }).notNull().default('Asia/Shanghai'),
  createdAt: datetime('created_at', { fsp: 6, mode: 'date' }).notNull().$defaultFn(() => new Date()),
  updatedAt: datetime('updated_at', { fsp: 6, mode: 'date' }).notNull().$defaultFn(() => new Date()).$onUpdateFn(() => new Date())
}, table => [
  foreignKey({
    name: 'user_preferences_user_id_fk',
    columns: [table.userId],
    foreignColumns: [users.id]
  }).onDelete('cascade')
])
