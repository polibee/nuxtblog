import { applyQuery, deleteRows, findRow, getCollection, insertRow, updateRow } from './db'
import { getConfig, validateInput } from './resourceConfigs'
import { requirePermission } from './auth'
import { emitCmsEvent } from './events'
import { snapshotRevision } from './revisions'
import { sanitizeRichText } from './sanitize'
import { maskSettingValue } from './setting-secrets'

type Evt = Parameters<typeof getQuery>[0]

/* =============================================================
 * Shared generic CRUD pipeline. Used by the [resource] parametric
 * routes AND by explicit routes inside static dirs (media/,
 * webhooks/) that would otherwise shadow the parametric router.
 * ============================================================= */

/** whitelist-sanitize rich-text values before they reach the store */
function sanitizeRichTextValues(resource: string, data: Record<string, unknown>): void {
  if (resource === 'posts' && typeof data.content === 'string') {
    data.content = sanitizeRichText(data.content)
    return
  }
  if (resource.startsWith('ct_')) {
    const slug = resource.slice(3)
    const type = getCollection('content-types').find(t => t.slug === slug) as
      | { fields?: Array<{ name: string, type: string }> }
      | undefined
    for (const field of type?.fields ?? []) {
      if (field.type === 'richtext' && typeof data[field.name] === 'string') {
        data[field.name] = sanitizeRichText(data[field.name] as string)
      }
    }
  }
}

export async function listResource(event: Evt, resource: string) {
  const cfg = getConfig(resource)
  await requirePermission(event, `${cfg.permissionPrefix}.view`)

  const query = getQuery(event) as {
    q?: string
    page?: number
    perPage?: number
    sortBy?: string
    sortDir?: string
  }
  const result = applyQuery(resource, query, { searchable: cfg.searchable })
  if (cfg.enrichList) result.items = cfg.enrichList(result.items)
  return result
}

export async function readResource(event: Evt, resource: string, id: number) {
  const cfg = getConfig(resource)
  await requirePermission(event, `${cfg.permissionPrefix}.view`)
  const row = findRow(resource, id)
  return resource === 'settings' && row.type === 'secret'
    ? { ...row, value: maskSettingValue(String(row.value ?? ''), 'secret') }
    : row
}

export async function createResource(event: Evt, resource: string, body: Record<string, unknown>) {
  const cfg = getConfig(resource)
  await requirePermission(event, `${cfg.permissionPrefix}.create`)

  const result = validateInput(resource, body ?? {}, 'create')
  if (!result.ok) {
    throw createError({ statusCode: 422, statusMessage: result.message })
  }
  if (cfg.validateRecord) {
    const message = cfg.validateRecord(result.data)
    if (message) throw createError({ statusCode: 422, statusMessage: message })
  }

  // server-managed defaults
  if (resource === 'orders' && !result.data.orderNo) {
    result.data.orderNo = `ORD-${Date.now().toString().slice(-6)}`
  }

  // content type builder: generate a unique collection slug
  if (resource === 'content-types' && !result.data.slug) {
    const base = String(result.data.name ?? 'type').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'type'
    const rows = getCollection('content-types')
    let slug = base
    let i = 1
    while (rows.some(r => r.slug === slug)) slug = `${base}-${++i}`
    result.data.slug = slug
  }

  // dynamic content lifecycle: everything starts as a draft
  if (resource.startsWith('ct_')) {
    if (!result.data.status) result.data.status = 'draft'
    if (result.data.status === 'published' && !result.data.publishedAt) {
      result.data.publishedAt = new Date().toISOString()
    }
  }

  sanitizeRichTextValues(resource, result.data)
  const row = insertRow(resource, result.data)
  await emitCmsEvent('content.afterCreate', { resource, record: row })
  return resource === 'settings' && row.type === 'secret'
    ? { ...row, value: maskSettingValue(String(row.value ?? ''), 'secret') }
    : row
}

export async function updateResource(event: Evt, resource: string, id: number, body: Record<string, unknown>) {
  const cfg = getConfig(resource)
  await requirePermission(event, `${cfg.permissionPrefix}.edit`)

  const result = validateInput(resource, body ?? {}, 'update')
  if (!result.ok) {
    throw createError({ statusCode: 422, statusMessage: result.message })
  }
  if (cfg.validateRecord) {
    const message = cfg.validateRecord(result.data)
    if (message) throw createError({ statusCode: 422, statusMessage: message })
  }
  if (Object.keys(result.data).length === 0) {
    throw createError({ statusCode: 422, statusMessage: 'No valid fields to update' })
  }

  const before = findRow(resource, id)
  await emitCmsEvent('content.beforeUpdate', { resource, id, patch: result.data, record: before })

  // lifecycle bookkeeping on transitions
  if (resource.startsWith('ct_')) {
    if (result.data.status === 'published' && !result.data.publishedAt) {
      result.data.publishedAt = new Date().toISOString()
    }
    if (result.data.status && result.data.status !== 'published' && result.data.status !== 'scheduled') {
      result.data.publishedAt = null
    }
  }

  sanitizeRichTextValues(resource, result.data)
  snapshotRevision(resource, before)
  const row = updateRow(resource, id, result.data)
  await emitCmsEvent('content.afterUpdate', { resource, id, record: row, patch: result.data })
  return resource === 'settings' && row.type === 'secret'
    ? { ...row, value: maskSettingValue(String(row.value ?? ''), 'secret') }
    : row
}

export async function deleteResource(event: Evt, resource: string, id: number) {
  const cfg = getConfig(resource)
  await requirePermission(event, `${cfg.permissionPrefix}.delete`)

  const before = findRow(resource, id)
  if (cfg.beforeDelete) {
    const message = cfg.beforeDelete(before)
    if (message) {
      throw createError({ statusCode: 409, statusMessage: message })
    }
  }
  await emitCmsEvent('content.beforeDelete', { resource, id, record: before })
  snapshotRevision(resource, before)

  deleteRows(resource, [id])

  // media: purge stored bytes alongside the record
  if (resource === 'media' && typeof before.storageKey === 'string' && before.storageKey) {
    await useStorage('media').removeItem(before.storageKey).catch(() => undefined)
  }

  await emitCmsEvent('content.afterDelete', { resource, id })
  return { removed: 1 }
}

export async function bulkDeleteResource(event: Evt, resource: string, ids: number[]) {
  const cfg = getConfig(resource)
  await requirePermission(event, `${cfg.permissionPrefix}.delete`)

  if (ids.length === 0) {
    throw createError({ statusCode: 422, statusMessage: 'No ids provided' })
  }

  for (const id of ids) {
    try {
      snapshotRevision(resource, findRow(resource, id))
    } catch {
      // already gone; bulk delete skips missing rows
    }
  }

  const removed = deleteRows(resource, ids)
  await emitCmsEvent('content.afterDelete', { resource, ids })
  return { removed }
}
