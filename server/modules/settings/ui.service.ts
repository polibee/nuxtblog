import { createError } from 'h3'
import { getDb, isBlogDbReady } from '../../repositories/db.server'
import { settings } from '../../repositories/schema/settings'
import { eq } from 'drizzle-orm'
import { invalidateSettingsCache } from './settings.service'
import { invalidatePageCache } from '../../utils/pageCache'
import {
  getSettingsPageDef,
  listSettingsPageDefs,
  type SettingDefinition,
  type SettingsPageDef
} from './registry'

/* P34 Settings Service (docs/设置.txt §42/48/49/67): the database stores
   overrides only; values resolve Environment > Database > Default.
   Saving writes the dotted key AND the legacy key (when defined) so
   pre-registry consumers keep working until they migrate. */

export type SettingSource = 'environment' | 'database' | 'default'

export interface ResolvedField {
  key: string
  type: SettingDefinition['type']
  label: { zh: string, en: string }
  description?: { zh: string, en: string }
  placeholder?: { zh: string, en: string }
  options?: Array<{ value: string, label: { zh: string, en: string } }>
  required?: boolean
  min?: number
  max?: number
  /* resolved value — secrets are masked out (§44) */
  value: string | number | boolean | null
  source: SettingSource
  /* secret fields only */
  configured?: boolean
  last4?: string
  visibleWhen?: { key: string, equals: string | number | boolean }
}

interface SettingRow {
  key: string
  value: string
  type: string
}

async function loadOverrides(keys: string[]): Promise<Map<string, SettingRow>> {
  const map = new Map<string, SettingRow>()
  if (keys.length === 0 || !isBlogDbReady()) return map
  const rows = await getDb()
    .select({ key: settings.key, value: settings.value, type: settings.type })
    .from(settings)
  for (const row of rows) {
    if (keys.includes(row.key)) map.set(row.key, row)
  }
  return map
}

function coerce(def: SettingDefinition, raw: string): string | number | boolean {
  if (def.type === 'switch') return raw === 'true' || raw === '1'
  if (def.type === 'number') return Number(raw)
  return raw
}

function encodeValue(def: SettingDefinition, value: string | number | boolean): string {
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  return String(value)
}

export async function resolveSettingsPage(pageId: string): Promise<{
  page: { id: string, group: string, title: { zh: string, en: string }, description: { zh: string, en: string }, icon: string }
  sections: Array<{ id: string, title: { zh: string, en: string }, description?: { zh: string, en: string }, fields: ResolvedField[] }>
}> {
  const def: SettingsPageDef | undefined = getSettingsPageDef(pageId)
  if (!def) throw createError({ statusCode: 404, statusMessage: `Unknown settings page "${pageId}"` })

  const allDefs = def.sections.flatMap(s => s.fields)
  const keys = allDefs.flatMap(d => [d.key, d.legacyKey].filter((k): k is string => Boolean(k)))
  const overrides = await loadOverrides(keys)
  /* optionsLoader fields get their options at read time (e.g. locales) */
  const resolvedDefs = await Promise.all(allDefs.map(d => dynamicOptions(d)))
  const defsByKey = new Map(resolvedDefs.map(d => [d.key, d]))

  const sections = def.sections.map(section => ({
    id: section.id,
    title: section.title,
    description: section.description,
    fields: section.fields.map((original): ResolvedField => {
      const field = defsByKey.get(original.key) ?? original
      /* §42: Environment > Database > Default */
      if (field.envKey && process.env[field.envKey]) {
        return baseField(field, {
          value: field.sensitive ? null : coerce(field, process.env[field.envKey]!),
          source: 'environment',
          configured: Boolean(process.env[field.envKey]),
          last4: maskLast4(process.env[field.envKey]!)
        })
      }
      const dotted = overrides.get(field.key)
      if (dotted) {
        return baseField(field, {
          value: field.sensitive ? null : coerce(field, dotted.value),
          source: 'database',
          configured: true,
          last4: field.sensitive ? maskLast4(dotted.value) : undefined
        })
      }
      const legacy = field.legacyKey ? overrides.get(field.legacyKey) : undefined
      if (legacy && legacy.value !== '') {
        return baseField(field, {
          value: field.sensitive ? null : coerce(field, legacy.value),
          source: 'database',
          configured: true,
          last4: field.sensitive ? maskLast4(legacy.value) : undefined
        })
      }
      const hasDefault = field.defaultValue !== undefined
      /* no effective override stored — the schema default shines through */
      return baseField(field, {
        value: hasDefault ? field.defaultValue! : null,
        source: 'default',
        configured: false,
        last4: undefined
      })
    })
  }))

  return {
    page: { id: def.id, group: def.group, title: def.title, description: def.description, icon: def.icon },
    sections
  }
}

function maskLast4(value: string): string | undefined {
  return value.length >= 4 ? value.slice(-4) : undefined
}

function baseField(field: SettingDefinition, extra: Pick<ResolvedField, 'value' | 'source' | 'configured' | 'last4'>): ResolvedField {
  return {
    key: field.key,
    type: field.type,
    label: field.label,
    description: field.description,
    placeholder: field.placeholder,
    options: field.options,
    required: field.required,
    min: field.min,
    max: field.max,
    visibleWhen: field.visibleWhen,
    ...extra
  }
}

/* optionsLoader fields get their options at read time (e.g. locales) */
async function dynamicOptions(field: SettingDefinition): Promise<SettingDefinition> {
  if (field.optionsLoader !== 'locales') return field
  const { listLocales } = await import('../../repositories/locale.repository')
  const locales = isBlogDbReady() ? await listLocales() : []
  return {
    ...field,
    options: locales.map(l => ({ value: l.code, label: { zh: l.nativeName || l.code, en: l.nativeName || l.code } }))
  }
}

/* the public settings endpoint caches per-locale (page:public-settings:{code})
   — purge every known locale suffix, not the bare key */
async function invalidatePublicSettingsCache(): Promise<void> {
  const targets = ['public-settings:default']
  try {
    const { listLocales } = await import('../../repositories/locale.repository')
    for (const locale of await listLocales()) targets.push(`public-settings:${locale.code}`)
  } catch { /* db down — nothing to purge */ }
  await invalidatePageCache(targets)
}

/* ---------------- save + reset (§8/46/48/59/67) ---------------- */

function validateValue(def: SettingDefinition, value: unknown): string | number | boolean {
  if (def.sensitive) {
    const raw = String(value ?? '')
    if (!raw) throw createError({ statusCode: 422, statusMessage: `${def.key}: empty secret` })
    return raw
  }
  if (def.type === 'switch') return Boolean(value)
  if (def.type === 'number') {
    const num = Number(value)
    if (Number.isNaN(num)) throw createError({ statusCode: 422, statusMessage: `${def.key}: not a number` })
    if (def.min !== undefined && num < def.min) throw createError({ statusCode: 422, statusMessage: `${def.key}: below minimum ${def.min}` })
    if (def.max !== undefined && num > def.max) throw createError({ statusCode: 422, statusMessage: `${def.key}: above maximum ${def.max}` })
    return num
  }
  const raw = String(value ?? '')
  if (def.required && !raw.trim()) throw createError({ statusCode: 422, statusMessage: `${def.key}: required` })
  if (def.type === 'select' && def.options && !def.options.some(o => o.value === raw)) {
    throw createError({ statusCode: 422, statusMessage: `${def.key}: invalid option` })
  }
  return raw
}

async function upsertOverride(def: SettingDefinition, value: string | number | boolean): Promise<void> {
  const encoded = encodeValue(def, value)
  const type = def.type === 'switch' ? 'boolean' : def.type === 'number' ? 'number' : def.sensitive ? 'secret' : 'string'
  const db = getDb()
  const [existing] = await db.select({ id: settings.id }).from(settings).where(eq(settings.key, def.key)).limit(1)
  if (existing) {
    await db.update(settings).set({ value: encoded, type }).where(eq(settings.id, existing.id))
  } else {
    /* is_public/description have no DB defaults (settings.txt §44:
       machine-managed rows are private) */
    await db.insert(settings).values({ key: def.key, value: encoded, type, group: def.key.split('.')[0], publicFlag: false })
  }
  /* legacy adapter: keep pre-registry consumers working (§42) */
  if (def.legacyKey) {
    const [legacy] = await db.select({ id: settings.id }).from(settings).where(eq(settings.key, def.legacyKey)).limit(1)
    if (legacy) {
      await db.update(settings).set({ value: encoded }).where(eq(settings.id, legacy.id))
    } else {
      await db.insert(settings).values({ key: def.legacyKey, value: encoded, type, group: def.key.split('.')[0], publicFlag: false })
    }
  }
}

export async function saveSettingsPage(pageId: string, values: Record<string, unknown>): Promise<{ saved: number }> {
  const def = getSettingsPageDef(pageId)
  if (!def) throw createError({ statusCode: 404, statusMessage: `Unknown settings page "${pageId}"` })
  const allDefs = def.sections.flatMap(s => s.fields)
  let saved = 0
  for (const [key, value] of Object.entries(values ?? {})) {
    const field = allDefs.find(d => d.key === key)
    /* §48: the registry is the validation source of truth — unknown
       keys and env-locked fields are rejected */
    if (!field) throw createError({ statusCode: 422, statusMessage: `Unknown setting "${key}"` })
    if (field.envKey && process.env[field.envKey]) {
      throw createError({ statusCode: 409, statusMessage: `${key}: managed by environment` })
    }
    const clean = validateValue(field, value)
    await upsertOverride(field, clean)
    saved++
  }
  /* Languages page: keep the locales registry in sync with the chosen
     default (设置.txt §34 — the registry entity owns the list, this
     setting picks the default) */
  if (typeof values['localization.default_locale'] === 'string' && isBlogDbReady()) {
    const { locales } = await import('../../repositories/schema/locales')
    const { ne } = await import('drizzle-orm')
    const code = values['localization.default_locale'] as string
    await getDb().update(locales).set({ isDefault: false }).where(ne(locales.code, code))
    await getDb().update(locales).set({ isDefault: true }).where(eq(locales.code, code))
  }
  if (saved > 0) {
    invalidateSettingsCache()
    await invalidatePublicSettingsCache()
  }
  return { saved }
}

export async function resetSettingsFields(pageId: string, keys: string[]): Promise<{ reset: number }> {
  const def = getSettingsPageDef(pageId)
  if (!def) throw createError({ statusCode: 404, statusMessage: `Unknown settings page "${pageId}"` })
  const allDefs = def.sections.flatMap(s => s.fields)
  let reset = 0
  for (const key of keys) {
    const field = allDefs.find(d => d.key === key)
    if (!field) continue
    /* §59/67: reset = delete the DB override; the default shines
       through. The legacy row must go too, or the legacy fallback in
       resolve() would still return the old value. */
    await getDb().delete(settings).where(eq(settings.key, field.key))
    if (field.legacyKey) {
      await getDb().delete(settings).where(eq(settings.key, field.legacyKey))
    }
    reset++
  }
  if (reset > 0) {
    invalidateSettingsCache()
    await invalidatePublicSettingsCache()
  }
  return { reset }
}

/* ---------------- navigation + search index (§15/16) ---------------- */

export function settingsSearchIndex(): Array<{
  pageId: string
  group: string
  pageTitle: { zh: string, en: string }
  key: string
  label: { zh: string, en: string }
  description?: { zh: string, en: string }
  keywords: string[]
}> {
  const out: Array<ReturnType<typeof settingsSearchIndex>[number]> = []
  for (const page of listSettingsPageDefs()) {
    for (const section of page.sections) {
      for (const field of section.fields) {
        out.push({
          pageId: page.id,
          group: page.group,
          pageTitle: page.title,
          key: field.key,
          label: field.label,
          description: field.description,
          keywords: [section.title.en, section.title.zh, ...field.key.split('.')]
        })
      }
    }
  }
  return out
}
