import { and, asc, count, desc, eq, like, ne, or } from 'drizzle-orm'
import { getDb, isBlogDbReady } from './db.server'
import { users } from './schema/users'
import type { UserRecord } from '#shared/schemas/user'

export type UserRow = typeof users.$inferSelect

function toRecord(row: UserRow): UserRecord {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role as UserRecord['role'],
    status: row.status as UserRecord['status'],
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  }
}

export interface UserListQuery {
  q?: string
  page?: number
  perPage?: number
  sortBy?: string
  sortDir?: string
}

export async function listUsers(query: UserListQuery): Promise<{
  items: UserRecord[]
  total: number
  page: number
  perPage: number
  totalPages: number
}> {
  const db = getDb()
  const term = query.q?.trim().toLowerCase()
  const where = term
    ? or(
        like(users.email, `%${term}%`),
        like(users.name, `%${term}%`)
      )
    : undefined

  const sortColumn = query.sortBy === 'name'
    ? users.name
    : query.sortBy === 'email'
      ? users.email
      : query.sortBy === 'createdAt'
        ? users.createdAt
        : users.id
  const direction = query.sortDir === 'asc' ? asc : desc

  const perPage = Math.min(Math.max(Number(query.perPage) || 10, 1), 200)
  const page = Math.max(Number(query.page) || 1, 1)

  const [totals] = await db.select({ total: count() }).from(users).where(where)
  const rows = await db
    .select()
    .from(users)
    .where(where)
    .orderBy(direction(sortColumn))
    .limit(perPage)
    .offset((page - 1) * perPage)

  const total = totals?.total ?? 0
  return {
    items: rows.map(toRecord),
    total,
    page,
    perPage,
    totalPages: Math.max(Math.ceil(total / perPage), 1)
  }
}

export async function findUserById(id: number): Promise<UserRecord | undefined> {
  const rows = await getDb().select().from(users).where(eq(users.id, id)).limit(1)
  return rows[0] ? toRecord(rows[0]) : undefined
}

export async function findUserRowByEmail(email: string): Promise<UserRow | undefined> {
  const rows = await getDb().select().from(users).where(eq(users.email, email.toLowerCase())).limit(1)
  return rows[0]
}

export async function findUserRowById(id: number): Promise<UserRow | undefined> {
  const rows = await getDb().select().from(users).where(eq(users.id, id)).limit(1)
  return rows[0]
}

export async function emailExists(email: string, excludeId?: number): Promise<boolean> {
  const condition = excludeId !== undefined
    ? and(eq(users.email, email.toLowerCase()), ne(users.id, excludeId))
    : eq(users.email, email.toLowerCase())
  const [row] = await getDb().select({ total: count() }).from(users).where(condition)
  return (row?.total ?? 0) > 0
}

export async function insertUser(input: {
  email: string
  passwordHash: string
  name: string
  role: string
  status: string
}): Promise<UserRecord> {
  const [row] = await getDb().insert(users).values(input)
  if (!row) throw new Error('user insert returned no id')
  const created = await findUserById(row.insertId)
  if (!created) throw new Error('user disappeared after insert')
  return created
}

export async function updateUserRow(
  id: number,
  patch: Partial<{ email: string, name: string, role: string, status: string, passwordHash: string }>
): Promise<void> {
  await getDb().update(users).set(patch).where(eq(users.id, id))
}

export async function deleteUserRow(id: number): Promise<void> {
  await getDb().delete(users).where(eq(users.id, id))
}

export async function countUsers(): Promise<number> {
  if (!isBlogDbReady()) return 0
  const [row] = await getDb().select({ total: count() }).from(users)
  return row?.total ?? 0
}

export async function countUsersByRoleAndStatus(role: string, status: string): Promise<number> {
  const [row] = await getDb()
    .select({ total: count() })
    .from(users)
    .where(and(eq(users.role, role), eq(users.status, status)))
  return row?.total ?? 0
}

export async function countUsersByStatus(status: string): Promise<number> {
  const [row] = await getDb()
    .select({ total: count() })
    .from(users)
    .where(eq(users.status, status))
  return row?.total ?? 0
}
