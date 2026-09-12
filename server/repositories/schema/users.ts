import {
  bigint,
  datetime,
  foreignKey,
  index,
  mysqlTable,
  uniqueIndex,
  varchar
} from 'drizzle-orm/mysql-core'

/* Authentication tables (P01). Sessions store only the SHA-256 of the
   cookie token; password reset tokens follow the same hashed pattern. */

export const users = mysqlTable(
  'users',
  {
    id: bigint('id', { mode: 'number' }).notNull().autoincrement().primaryKey(),
    email: varchar('email', { length: 255 }).notNull(),
    passwordHash: varchar('password_hash', { length: 255 }).notNull(),
    name: varchar('name', { length: 80 }).notNull(),
    role: varchar('role', { length: 20 }).notNull().default('viewer'),
    status: varchar('status', { length: 20 }).notNull().default('active'),
    createdAt: datetime('created_at', { fsp: 6, mode: 'date' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: datetime('updated_at', { fsp: 6, mode: 'date' })
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdateFn(() => new Date())
  },
  table => [
    uniqueIndex('users_email_key').on(table.email),
    index('users_role_idx').on(table.role),
    index('users_status_idx').on(table.status)
  ]
)

export const sessions = mysqlTable(
  'sessions',
  {
    id: bigint('id', { mode: 'number' }).notNull().autoincrement().primaryKey(),
    tokenHash: varchar('token_hash', { length: 64 }).notNull(),
    userId: bigint('user_id', { mode: 'number' }).notNull(),
    expiresAt: datetime('expires_at', { fsp: 6, mode: 'date' }).notNull(),
    createdAt: datetime('created_at', { fsp: 6, mode: 'date' })
      .notNull()
      .$defaultFn(() => new Date())
  },
  table => [
    uniqueIndex('sessions_token_hash_key').on(table.tokenHash),
    index('sessions_user_idx').on(table.userId),
    index('sessions_expires_idx').on(table.expiresAt),
    foreignKey({
      name: 'sessions_user_id_fk',
      columns: [table.userId],
      foreignColumns: [users.id]
    }).onDelete('cascade')
  ]
)

export const passwordResetTokens = mysqlTable(
  'password_reset_tokens',
  {
    id: bigint('id', { mode: 'number' }).notNull().autoincrement().primaryKey(),
    tokenHash: varchar('token_hash', { length: 64 }).notNull(),
    userId: bigint('user_id', { mode: 'number' }).notNull(),
    expiresAt: datetime('expires_at', { fsp: 6, mode: 'date' }).notNull(),
    usedAt: datetime('used_at', { fsp: 6, mode: 'date' }),
    createdAt: datetime('created_at', { fsp: 6, mode: 'date' })
      .notNull()
      .$defaultFn(() => new Date())
  },
  table => [
    uniqueIndex('password_reset_tokens_token_hash_key').on(table.tokenHash),
    index('password_reset_tokens_user_idx').on(table.userId),
    foreignKey({
      name: 'password_reset_tokens_user_id_fk',
      columns: [table.userId],
      foreignColumns: [users.id]
    }).onDelete('cascade')
  ]
)
