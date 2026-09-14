/* =============================================================
 * Server-side resource registry: known fields, types and search
 * columns per resource. Mirrors the client schema for validation.
 * Static configs + runtime content types ("ct_*") created via the
 * Content Type builder.
 * ============================================================= */

import { getCollection } from './db'
import { parseWebhookTarget } from './webhook'
import { maskSettingValue } from './setting-secrets'

interface FieldConfig {
  type: 'string' | 'number' | 'boolean' | 'list' | 'any'
  required?: boolean
  enum?: string[]
}

export interface ServerResourceConfig {
  label: string
  searchable: string[]
  fields: Record<string, FieldConfig>
  /** permission prefix for write operations, e.g. "users" */
  permissionPrefix: string
  /** fields stripped on update (identity/foreign keys) */
  immutableFields?: string[]
  /** extra record-level validation after field coercion (create & update) */
  validateRecord?: (data: Record<string, unknown>) => string | null
  /** decorate list rows before they are returned (tree depth, counts, masking…) */
  enrichList?: (items: Array<Record<string, unknown>>) => Array<Record<string, unknown>>
  /** veto delete; return an error message to block */
  beforeDelete?: (record: Record<string, unknown>) => string | null
}

export const RESOURCE_CONFIGS: Record<string, ServerResourceConfig> = {
  'users': {
    label: 'User',
    searchable: ['name', 'email'],
    permissionPrefix: 'users',
    fields: {
      name: { type: 'string', required: true },
      email: { type: 'string', required: true },
      role: { type: 'string', enum: ['admin', 'editor', 'viewer'] },
      status: { type: 'string', enum: ['active', 'inactive'] }
    }
  },
  'posts': {
    label: 'Post',
    searchable: ['title', 'slug'],
    permissionPrefix: 'posts',
    fields: {
      title: { type: 'string', required: true },
      slug: { type: 'string', required: true },
      content: { type: 'string' },
      status: { type: 'string', enum: ['draft', 'published', 'archived'] },
      authorId: { type: 'number' },
      views: { type: 'number' },
      publishedAt: { type: 'string' }
    }
  },
  'orders': {
    label: 'Order',
    searchable: ['orderNo', 'customerName'],
    permissionPrefix: 'orders',
    fields: {
      orderNo: { type: 'string' },
      customerName: { type: 'string', required: true },
      amount: { type: 'number', required: true },
      status: { type: 'string', enum: ['pending', 'paid', 'shipped', 'completed', 'refunded'] }
    }
  },
  'roles': {
    label: 'Role',
    searchable: ['name'],
    permissionPrefix: 'roles',
    immutableFields: ['key'],
    fields: {
      name: { type: 'string', required: true },
      key: { type: 'string' },
      permissions: { type: 'list' }
    }
  },
  'media': {
    label: 'Media',
    searchable: ['filename'],
    permissionPrefix: 'media',
    immutableFields: ['filename', 'mime', 'size', 'storageKey', 'url'],
    fields: {
      filename: { type: 'string' },
      mime: { type: 'string' },
      size: { type: 'number' },
      storageKey: { type: 'string' },
      url: { type: 'string' }
    }
  },
  'content-types': {
    label: 'Content Type',
    searchable: ['name'],
    permissionPrefix: 'content-types',
    immutableFields: ['slug'],
    fields: {
      name: { type: 'string', required: true },
      slug: { type: 'string' },
      fields: { type: 'list' }
    }
  },
  'webhooks': {
    label: 'Webhook',
    searchable: ['url', 'events'],
    permissionPrefix: 'webhooks',
    fields: {
      url: { type: 'string', required: true },
      events: { type: 'string', required: true },
      enabled: { type: 'boolean' },
      secret: { type: 'string' }
    },
    validateRecord: (data) => {
      if (typeof data.url === 'string') {
        const parsed = parseWebhookTarget(data.url)
        if (!parsed.ok) return parsed.message
      }
      if (typeof data.events === 'string') {
        const events = data.events.split(',').map(s => s.trim()).filter(Boolean)
        if (events.length === 0) return '"events" must list at least one event'
      }
      return null
    }
  },
  'revisions': {
    label: 'Revision',
    searchable: ['resource', 'key'],
    permissionPrefix: 'revisions',
    immutableFields: ['key', 'resource', 'recordId', 'version', 'data'],
    fields: {
      key: { type: 'string' },
      resource: { type: 'string' },
      recordId: { type: 'number' },
      version: { type: 'number' },
      data: { type: 'list' }
    }
  },
  'taxonomy': {
    label: 'Taxonomy Term',
    searchable: ['name', 'slug'],
    permissionPrefix: 'taxonomy',
    fields: {
      name: { type: 'string', required: true },
      key: { type: 'string', enum: ['category', 'tag'] },
      slug: { type: 'string' },
      parentId: { type: 'number' }
    },
    beforeDelete: (record) => {
      const children = getCollection('taxonomy').filter(t => t.parentId === record.id)
      return children.length > 0
        ? `Cannot delete "${String(record.name)}": ${children.length} child term(s) reference it. Reassign or delete them first.`
        : null
    },
    enrichList: (items) => {
      const byId = new Map(items.map(r => [r.id, r]))
      const depthOf = (row: Record<string, unknown>, guard: number): number => {
        if (guard > 20) return 0
        const parentId = row.parentId as number | null | undefined
        if (parentId == null) return 0
        const parent = byId.get(parentId)
        return parent ? 1 + depthOf(parent, guard + 1) : 0
      }
      const pathOf = (row: Record<string, unknown>, guard: number): string => {
        if (guard > 20) return ''
        const parentId = row.parentId as number | null | undefined
        if (parentId == null) return String(row.name ?? '')
        const parent = byId.get(parentId)
        return parent ? `${pathOf(parent, guard + 1)} / ${String(row.name ?? '')}` : String(row.name ?? '')
      }
      const decorated = items.map((row) => {
        const childCount = items.filter(r => r.parentId === row.id).length
        return { ...row, depth: depthOf(row, 0), path: pathOf(row, 0), childCount }
      })
      // tree order: sort by path so children follow their parent
      return decorated.sort((a, b) => String(a.path).localeCompare(String(b.path)))
    }
  },
  'menus': {
    label: 'Menu',
    searchable: ['name'],
    permissionPrefix: 'menus',
    fields: {
      name: { type: 'string', required: true },
      location: { type: 'string', enum: ['header', 'footer', 'custom'] },
      items: { type: 'list' }
    },
    enrichList: (items) => {
      const countItems = (node: unknown): number => {
        if (!node || typeof node !== 'object') return 0
        const item = node as { children?: unknown[] }
        const children = Array.isArray(item.children) ? item.children : []
        return 1 + children.reduce((n: number, c: unknown) => n + countItems(c), 0)
      }
      return items.map((row) => {
        const itemsList = Array.isArray(row.items) ? row.items : []
        return { ...row, itemCount: itemsList.reduce((n: number, c: unknown) => n + countItems(c), 0) }
      })
    }
  },
  'settings': {
    label: 'Setting',
    searchable: ['key', 'group'],
    permissionPrefix: 'settings',
    immutableFields: ['key'],
    fields: {
      key: { type: 'string', required: true },
      value: { type: 'any' },
      type: { type: 'string', enum: ['string', 'text', 'number', 'boolean', 'secret'] },
      group: { type: 'string', required: true },
      public: { type: 'boolean' },
      description: { type: 'string' }
    },
    enrichList: items => items.map(row => (
      row.type === 'secret' ? { ...row, value: maskSettingValue(String(row.value ?? ''), 'secret') } : row
    ))
  }
}

/** build a server config from a stored content type definition */
function dynamicConfig(name: string): ServerResourceConfig | undefined {
  if (!name.startsWith('ct_')) return undefined
  const slug = name.slice(3)
  const type = getCollection('content-types').find(t => t.slug === slug) as
    | { name: string, slug: string, fields: Array<{ name: string, label: string, type: string, required?: boolean, options?: string }> }
    | undefined
  if (!type) return undefined

  const fields: Record<string, FieldConfig> = {}
  const searchable: string[] = []
  for (const field of type.fields) {
    switch (field.type) {
      case 'number':
        fields[field.name] = { type: 'number', required: field.required }
        break
      case 'boolean':
        fields[field.name] = { type: 'boolean', required: field.required }
        break
      case 'select':
        fields[field.name] = {
          type: 'string',
          required: field.required,
          enum: (field.options ?? '').split(',').map(s => s.trim()).filter(Boolean)
        }
        break
      case 'richtext':
        // rich text stored as HTML string; excluded from search
        fields[field.name] = { type: 'string', required: field.required }
        break
      default:
        fields[field.name] = { type: 'string', required: field.required }
        searchable.push(field.name)
    }
  }

  // content lifecycle fields (user-defined fields take precedence)
  if (!fields.status) {
    fields.status = {
      type: 'string',
      enum: ['draft', 'review', 'scheduled', 'published', 'archived']
    }
  }
  if (!fields.publishedAt) fields.publishedAt = { type: 'string' }
  if (!fields.scheduledAt) fields.scheduledAt = { type: 'string' }

  // SEO meta fields (consume by sitemap/preview; theme reads them too)
  if (!fields.seoTitle) fields.seoTitle = { type: 'string' }
  if (!fields.seoDescription) fields.seoDescription = { type: 'string' }
  if (!fields.canonical) fields.canonical = { type: 'string' }
  if (!fields.robots) fields.robots = { type: 'string', enum: ['index', 'noindex'] }

  return { label: type.name, searchable, fields, permissionPrefix: 'content' }
}

export function getConfig(name: string): ServerResourceConfig {
  const cfg = RESOURCE_CONFIGS[name] ?? dynamicConfig(name)
  if (!cfg) throw createError({ statusCode: 404, statusMessage: `Unknown resource "${name}"` })
  return cfg
}

type ValidateResult
  = | { ok: true, data: Record<string, unknown> }
    | { ok: false, message: string }

/** event-handler style keys (onclick, onerror…) are never allowed through */
const EVENT_KEY_RE = /^on/i
/** javascript:/data: URIs in stored strings are never allowed through */
const SCRIPT_SCHEME_RE = /^\s*(javascript|data|vbscript):/i

/**
 * Recursive sanitizer for list-typed values: primitives stay, objects
 * keep primitive props MINUS event-handler keys and script-scheme values.
 * (Denylist for known-dangerous patterns; rendering-side escaping is
 * the primary defense - this is defense in depth for stored JSON.)
 */
function sanitizeListItem(item: unknown): unknown {
  if (item === null || typeof item !== 'object') {
    if (typeof item === 'string' && SCRIPT_SCHEME_RE.test(item)) return ''
    return item
  }
  if (Array.isArray(item)) return item.map(sanitizeListItem)
  const clean: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(item as Record<string, unknown>)) {
    if (EVENT_KEY_RE.test(k)) continue
    if (v === null || typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
      if (typeof v === 'string' && SCRIPT_SCHEME_RE.test(v)) continue
      clean[k] = v
    } else if (Array.isArray(v)) {
      clean[k] = v.map(sanitizeListItem)
    }
  }
  return clean
}

/** create = full validation (required enforced); update = partial */
export function validateInput(
  name: string,
  body: Record<string, unknown>,
  mode: 'create' | 'update'
): ValidateResult {
  const cfg = getConfig(name)
  const data: Record<string, unknown> = {}

  if (!body || typeof body !== 'object') {
    return { ok: false, message: 'Invalid request body' }
  }

  for (const [field, rule] of Object.entries(cfg.fields)) {
    const value = body[field]

    // immutable fields (identity/foreign keys) can only be set on create
    if (mode === 'update' && cfg.immutableFields?.includes(field)) continue

    if (value === undefined || value === null || value === '') {
      if (mode === 'create' && rule.required) {
        return { ok: false, message: `"${field}" is required` }
      }
      continue
    }

    if (rule.type === 'number') {
      const n = Number(value)
      if (Number.isNaN(n)) return { ok: false, message: `"${field}" must be a number` }
      data[field] = n
      continue
    }

    if (rule.type === 'boolean') {
      data[field] = Boolean(value)
      continue
    }

    if (rule.type === 'list') {
      if (!Array.isArray(value)) return { ok: false, message: `"${field}" must be an array` }
      data[field] = value.map(sanitizeListItem)
      continue
    }

    if (rule.type === 'any') {
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        data[field] = value
      } else {
        return { ok: false, message: `"${field}" must be a string, number or boolean` }
      }
      continue
    }

    const str = String(value)
    if (rule.enum && !rule.enum.includes(str)) {
      return { ok: false, message: `"${field}" must be one of: ${rule.enum.join(', ')}` }
    }
    data[field] = str
  }

  // unknown keys are never copied into `data`, so the store stays clean

  return { ok: true, data }
}
