import { createError } from 'h3'
import { and, asc, eq } from 'drizzle-orm'
import { getPostgresDb, isPostgresBlogDbReady } from '../../repositories/db-postgres.server'
import { listLocales } from '../../repositories/locale.runtime.repository'
import { localizedSettings, settings } from '../../repositories/schema-postgres/settings'

/* Settings domain service (P02): the DB is the single source of truth
   for runtime settings. Values are stored as strings and coerced by
   the declared type on read. A short module-level cache absorbs hot
   readers (mail, page cache, public endpoint); writes invalidate it. */

export type SettingType = 'string' | 'text' | 'number' | 'boolean' | 'secret' | 'json'

export interface SettingItem {
  id: number
  key: string
  value: string | number | boolean
  type: SettingType
  group: string
  public: boolean
  description?: string
}

const CACHE_TTL_MS = 60_000
let cache: { at: number, items: SettingItem[] } | null = null

export function invalidateSettingsCache(): void {
  cache = null
}

export function coerceSettingValue(raw: string, type: SettingType): string | number | boolean {
  switch (type) {
    case 'number': {
      const n = Number(raw)
      return Number.isFinite(n) ? n : raw
    }
    case 'boolean':
      return raw === 'true' || raw === '1'
    default:
      return raw
  }
}

function toItem(row: typeof settings.$inferSelect): SettingItem {
  return {
    id: row.id,
    key: row.key,
    value: coerceSettingValue(row.value, row.type as SettingType),
    type: row.type as SettingType,
    group: row.group,
    public: row.publicFlag,
    description: row.description ?? undefined
  }
}

async function allItems(): Promise<SettingItem[]> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.items
  const rows = await getPostgresDb()
    .select()
    .from(settings)
    .orderBy(asc(settings.group), asc(settings.sortOrder), asc(settings.id))
  const items = rows.map(toItem)
  cache = { at: Date.now(), items }
  return items
}

/** all settings for the admin UI (secrets included; UI keeps them masked) */
export async function listSettings(): Promise<SettingItem[]> {
  if (!isPostgresBlogDbReady()) return []
  return allItems()
}

/** typed read with fallback; secrets are returned as-is to server code only */
export async function getSettingValue(key: string, fallback: string | number | boolean = ''): Promise<string | number | boolean> {
  if (!isPostgresBlogDbReady()) return fallback
  const items = await allItems()
  const found = items.find(s => s.key === key)
  return found ? found.value : fallback
}

export async function getSettingItem(key: string): Promise<SettingItem | undefined> {
  if (!isPostgresBlogDbReady()) return undefined
  const items = await allItems()
  return items.find(s => s.key === key)
}

async function upsertRow(input: {
  key: string
  value: string
  type: SettingType
  group: string
  publicFlag: boolean
  description?: string
}): Promise<void> {
  const db = getPostgresDb()
  await db
    .insert(settings)
    .values(input)
    .onConflictDoUpdate({ target: settings.key, set: {
      value: input.value,
      type: input.type,
      group: input.group,
      publicFlag: input.publicFlag,
      description: input.description ?? null
    } })
}

export async function createSetting(body: {
  key: string
  value: string | number | boolean
  type?: SettingType
  group?: string
  public?: boolean
  description?: string
}): Promise<SettingItem> {
  const key = String(body.key ?? '').trim().toUpperCase()
  if (!/^[A-Z0-9_]{2,80}$/.test(key)) {
    throw createError({ statusCode: 422, statusMessage: 'Key must be 2-80 chars of A-Z, 0-9, underscore' })
  }
  const existing = await getSettingItem(key)
  if (existing) {
    throw createError({ statusCode: 409, statusMessage: `Setting "${key}" already exists` })
  }
  await upsertRow({
    key,
    value: String(body.value ?? ''),
    type: body.type ?? 'string',
    group: body.group ?? 'General',
    publicFlag: body.public ?? false,
    description: body.description
  })
  invalidateSettingsCache()
  const created = await getSettingItem(key)
  if (!created) throw createError({ statusCode: 500, statusMessage: 'Setting disappeared after create' })
  return created
}

/** update the value only (admin group form contract) */
export async function updateSettingValue(id: number, value: string | number | boolean): Promise<SettingItem> {
  const db = getPostgresDb()
  const [row] = await db.select().from(settings).where(eq(settings.id, id)).limit(1)
  if (!row) {
    throw createError({ statusCode: 404, statusMessage: `Setting #${id} not found` })
  }
  await db.update(settings).set({ value: String(value) }).where(eq(settings.id, id))
  invalidateSettingsCache()
  return { ...toItem({ ...row, value: String(value) }) }
}

export async function deleteSetting(id: number): Promise<void> {
  const db = getPostgresDb()
  const result = await db.delete(settings).where(eq(settings.id, id))
  if ((result.rowCount ?? 0) === 0) {
    throw createError({ statusCode: 404, statusMessage: `Setting #${id} not found` })
  }
  invalidateSettingsCache()
}

/** public (non-secret) settings map for the frontend layer */
export async function publicSettingsMap(): Promise<Record<string, string | number | boolean>> {
  if (!isPostgresBlogDbReady()) return {}
  const items = await allItems()
  const map: Record<string, string | number | boolean> = {}
  for (const item of items) {
    if (item.public && item.type !== 'secret') map[item.key] = item.value
  }
  return map
}

/* ---------------- localized settings ---------------- */

/** per-locale override map for one locale id (e.g. SITE_DESCRIPTION) */
export async function localizedSettingsMap(localeId: number): Promise<Record<string, string>> {
  if (!isPostgresBlogDbReady()) return {}
  const rows = await getPostgresDb()
    .select()
    .from(localizedSettings)
    .where(eq(localizedSettings.localeId, localeId))
  return Object.fromEntries(rows.map(r => [r.key, r.value]))
}

export async function setLocalizedSetting(key: string, localeId: number, value: string): Promise<void> {
  await getPostgresDb()
    .insert(localizedSettings)
    .values({ key: key.toUpperCase(), localeId, value })
    .onConflictDoUpdate({ target: [localizedSettings.key, localizedSettings.localeId], set: { value } })
}

export async function listLocalizedSettings(): Promise<Array<{ key: string, localeId: number, value: string }>> {
  if (!isPostgresBlogDbReady()) return []
  const rows = await getPostgresDb()
    .select()
    .from(localizedSettings)
    .orderBy(asc(localizedSettings.key))
  return rows.map(r => ({ key: r.key, localeId: r.localeId, value: r.value }))
}

export async function deleteLocalizedSetting(key: string, localeId: number): Promise<void> {
  await getPostgresDb()
    .delete(localizedSettings)
    .where(and(eq(localizedSettings.key, key.toUpperCase()), eq(localizedSettings.localeId, localeId)))
}

/* ---------------- boot seed (mirrors the legacy demo seed) ---------------- */

const DEFAULT_SETTINGS: Array<Omit<Parameters<typeof upsertRow>[0], never>> = [
  { key: 'SITE_NAME', value: 'Blog Framework', type: 'string', group: 'General', publicFlag: true, description: 'Shown in the site header and <title>.' },
  { key: 'SITE_URL', value: '', type: 'string', group: 'General', publicFlag: true, description: 'Canonical origin of the site.' },
  { key: 'SITE_DESCRIPTION', value: 'A blog framework built on Nuxt + NuxtAdmin.', type: 'text', group: 'General', publicFlag: true, description: 'Default meta description (localizable).' },
  { key: 'MAINTENANCE_MODE', value: 'false', type: 'boolean', group: 'General', publicFlag: true, description: 'Show a maintenance notice on public pages.' },
  { key: 'POSTS_PER_PAGE', value: '12', type: 'number', group: 'Blog', publicFlag: true, description: 'Posts per page on public listing pages.' },
  { key: 'SMTP_HOST', value: '', type: 'string', group: 'Email', publicFlag: false },
  { key: 'SMTP_PASSWORD', value: '', type: 'secret', group: 'Email', publicFlag: false, description: 'Never exposed by the public settings endpoint.' },
  { key: 'CACHE_DRIVER', value: 'memory', type: 'string', group: 'Cache', publicFlag: false },
  { key: 'PAGE_CACHE_ENABLED', value: 'true', type: 'boolean', group: 'Cache', publicFlag: false, description: 'WP-style page cache switch.' },
  { key: 'ADVERTISING_PURCHASE_ENABLED', value: 'true', type: 'boolean', group: 'Advertising', publicFlag: true, description: 'Enable the public ad purchase page.' }
]

export async function seedDefaultSettings(): Promise<void> {
  if (!isPostgresBlogDbReady()) return
  for (const input of DEFAULT_SETTINGS) {
    await upsertRowIfMissing(input)
  }
  invalidateSettingsCache()
  console.log('[blog-db] settings seeded')
}

async function upsertRowIfMissing(input: Parameters<typeof upsertRow>[0]): Promise<void> {
  const existing = await getSettingItem(input.key)
  if (existing) return
  await upsertRow(input)
}

/** seed the zh-CN localized site description once the default locale exists */
export async function seedLocalizedSettings(): Promise<void> {
  const locales = await listLocales()
  const zh = locales.find(l => l.isDefault) ?? locales[0]
  if (!zh) return
  const existing = await listLocalizedSettings()
  if (existing.some(s => s.key === 'SITE_DESCRIPTION' && s.localeId === zh.id)) return
  await setLocalizedSetting('SITE_DESCRIPTION', zh.id, '基于 Nuxt 4 + NuxtAdmin 的全栈博客框架。')
}
