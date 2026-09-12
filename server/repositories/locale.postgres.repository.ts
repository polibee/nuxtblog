import { and, asc, count, eq } from 'drizzle-orm'
import { getPostgresDb } from './db-postgres.server'
import { locales } from './schema-postgres/locales'
import type { LocaleSummary } from '#shared/types/locale'

/* Locale registry repository. Reads only in P00; writes arrive with
   the P02 Locale Registry admin resource. Throws when the blog DB is
   not initialized - callers decide how to degrade. */

function toSummary(row: typeof locales.$inferSelect): LocaleSummary {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    nativeName: row.nativeName,
    urlPrefix: row.urlPrefix,
    enabled: row.enabled,
    contentEnabled: row.contentEnabled,
    uiEnabled: row.uiEnabled,
    isDefault: row.isDefault,
    sortOrder: row.sortOrder
  }
}

export async function listLocales(options: { enabledOnly?: boolean } = {}): Promise<LocaleSummary[]> {
  const db = getPostgresDb()
  const where = options.enabledOnly ? eq(locales.enabled, true) : undefined
  const rows = await db
    .select()
    .from(locales)
    .where(where ? and(where) : undefined)
    .orderBy(asc(locales.sortOrder), asc(locales.id))
  return rows.map(toSummary)
}

export async function findLocaleByCode(code: string): Promise<LocaleSummary | undefined> {
  const db = getPostgresDb()
  const rows = await db.select().from(locales).where(eq(locales.code, code)).limit(1)
  return rows[0] ? toSummary(rows[0]) : undefined
}

export async function findLocaleById(id: number): Promise<LocaleSummary | undefined> {
  const db = getPostgresDb()
  const rows = await db.select().from(locales).where(eq(locales.id, id)).limit(1)
  return rows[0] ? toSummary(rows[0]) : undefined
}

export async function findDefaultLocale(): Promise<LocaleSummary | undefined> {
  const db = getPostgresDb()
  const rows = await db.select().from(locales).where(eq(locales.isDefault, true)).limit(1)
  return rows[0] ? toSummary(rows[0]) : undefined
}

/* ---------------- writes (P02 Locale Registry) ---------------- */

export interface LocaleWriteInput {
  code: string
  name: string
  nativeName: string
  urlPrefix: string | null
  enabled: boolean
  contentEnabled: boolean
  uiEnabled: boolean
  isDefault: boolean
  sortOrder: number
}

export async function insertLocale(input: LocaleWriteInput): Promise<number> {
  const [row] = await getPostgresDb().insert(locales).values(input).returning({ id: locales.id })
  if (!row) throw new Error('locale insert returned no id')
  return row.id
}

export async function updateLocaleRow(id: number, patch: Partial<LocaleWriteInput>): Promise<void> {
  await getPostgresDb().update(locales).set(patch).where(eq(locales.id, id))
}

export async function clearDefaultFlags(): Promise<void> {
  await getPostgresDb().update(locales).set({ isDefault: false })
}

export async function countLocales(): Promise<number> {
  const [row] = await getPostgresDb().select({ total: count() }).from(locales)
  return row?.total ?? 0
}

export async function countContentLocales(): Promise<number> {
  const [row] = await getPostgresDb()
    .select({ total: count() })
    .from(locales)
    .where(and(eq(locales.enabled, true), eq(locales.contentEnabled, true)))
  return row?.total ?? 0
}

export async function deleteLocaleRow(id: number): Promise<void> {
  await getPostgresDb().delete(locales).where(eq(locales.id, id))
}
