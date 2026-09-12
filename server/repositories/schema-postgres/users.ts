import {
  bigint,
  timestamp,
  foreignKey,
  index,
  pgTable,
  uniqueIndex,
  varchar
} from 'drizzle-orm/pg-core'

/* Authentication tables (P01). Sessions store only the SHA-256 of the
   cookie token; password reset tokens follow the same hashed pattern. */

export const users = pgTable(
  'users',
  {
    id: bigint('id', { mode: 'number' }).notNull().generatedByDefaultAsIdentity().primaryKey(),
    email: varchar('email', { length: 255 }).notNull(),
    passwordHash: varchar('password_hash', { length: 255 }).notNull(),
    name: varchar('name', { length: 80 }).notNull(),
    role: varchar('role', { length: 20 }).notNull().default('viewer'),
    status: varchar('status', { length: 20 }).notNull().default('active'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
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

export const sessions = pgTable(
  'sessions',
  {
    id: bigint('id', { mode: 'number' }).notNull().generatedByDefaultAsIdentity().primaryKey(),
    tokenHash: varchar('token_hash', { length: 64 }).notNull(),
    userId: bigint('user_id', { mode: 'number' }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
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

export const passwordResetTokens = pgTable(
  'password_reset_tokens',
  {
    id: bigint('id', { mode: 'number' }).notNull().generatedByDefaultAsIdentity().primaryKey(),
    tokenHash: varchar('token_hash', { length: 64 }).notNull(),
    userId: bigint('user_id', { mode: 'number' }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull(),
    usedAt: timestamp('used_at', { withTimezone: true, mode: 'date' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
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
