import { createError } from 'h3'
import {
  navigationTreeSchema,
  type NavigationTreeInput,
  type NavigationTreeItemInput,
  type PublicNavigation,
  type PublicNavigationItem
} from '#shared/schemas/navigation'
import { isDomainDbReady } from '../../repositories/domain-status'
import { invalidateNavigationCache } from '../../utils/navigationCache'
import { listLocales } from '../../repositories/locale.runtime.repository'
import { findPublishedPageAliasById } from '../../repositories/page.runtime.repository'
import { findPublishedPostAliasById } from '../../repositories/post.runtime.repository'
import { findTaxonomyRow, findTaxonomyAliasById } from '../../repositories/taxonomy.runtime.repository'
import { contentUrl } from '../../utils/contentUrl'
import {
  copyVariantItems,
  deleteVariant,
  findNavigationByLocation,
  findNavigationRow,
  findVariant,
  findVariantById,
  insertVariant,
  listNavigations,
  listVariantItems,
  replaceVariantItems,
  type NavigationRecord,
  type NavigationVariantMeta
} from '../../repositories/navigation.runtime.repository'
import { updateVariantStatus, insertNavigation, updateNavigationMeta as updateNavigationMetaRow } from '../../repositories/navigation.runtime.repository'
import { resolveDisplayLabel } from '#shared/utils/display-label'

/* Navigation module service (navigation-menu-design.md §7).
   Variants are per-locale menu versions; saveNavigationTree replaces
   the item tree in one transaction; resolveNavigation returns the
   public DTO with locale-resolved URLs and hides broken targets. */

export type { NavigationRecord, NavigationVariantMeta }

const MAX_DEPTH = 3
const CACHE_TTL_SECONDS = 300

function parseTree(body: unknown): NavigationTreeInput {
  const result = navigationTreeSchema.safeParse(body)
  if (!result.success) {
    throw createError({
      statusCode: 422,
      statusMessage: result.error.issues[0]?.message ?? 'Invalid navigation tree'
    })
  }
  return result.data
}

/** custom link protocol guard: relative, http(s), mailto, tel only */
function assertSafeCustomUrl(url: string): void {
  if (url.startsWith('/')) return
  if (/^(https?|mailto|tel):/i.test(url)) return
  throw createError({
    statusCode: 422,
    statusMessage: `Custom URL "${url}" must be relative, http(s), mailto or tel`
  })
}

async function assertEntityExists(type: 'page' | 'post' | 'category' | 'tag', entityId: number): Promise<void> {
  let exists = false
  if (type === 'page') exists = Boolean(await findNavigationPageRow(entityId))
  if (type === 'post') exists = Boolean(await findNavigationPostRow(entityId))
  if (type === 'category') exists = Boolean(await findTaxonomyRow('category', entityId))
  if (type === 'tag') exists = Boolean(await findTaxonomyRow('tag', entityId))
  if (!exists) {
    throw createError({ statusCode: 422, statusMessage: `Referenced ${type} #${entityId} does not exist` })
  }
}

async function findNavigationPageRow(pageId: number): Promise<unknown> {
  const { findPageRow } = await import('../../repositories/page.runtime.repository')
  return findPageRow(pageId)
}

async function findNavigationPostRow(postId: number): Promise<unknown> {
  const { findPostRow } = await import('../../repositories/post.runtime.repository')
  return findPostRow(postId)
}

function collectTree(items: NavigationTreeItemInput[], depth: number, path: string[]): NavigationTreeItemInput[] {
  if (depth > MAX_DEPTH) {
    throw createError({ statusCode: 422, statusMessage: `Navigation tree exceeds ${MAX_DEPTH} levels` })
  }
  const flat: NavigationTreeItemInput[] = []
  for (const item of items) {
    if (path.includes(item.label)) {
      throw createError({ statusCode: 422, statusMessage: `Circular reference at "${item.label}"` })
    }
    if (item.type === 'custom') {
      if (item.customUrl) assertSafeCustomUrl(item.customUrl)
    } else if (item.type !== 'group') {
      if (!item.targetEntityType || !item.targetEntityId) {
        throw createError({
          statusCode: 422,
          statusMessage: `Item "${item.label}" needs a target entity reference`
        })
      }
    }
    flat.push(item)
    if (item.children?.length) flat.push(...collectTree(item.children, depth + 1, [...path, item.label]))
  }
  return flat
}

export async function saveNavigationTree(variantId: number, body: unknown): Promise<void> {
  const variant = await findVariantById(variantId)
  if (!variant) {
    throw createError({ statusCode: 404, statusMessage: `Navigation variant #${variantId} not found` })
  }
  const input = parseTree(body)

  for (const item of collectTree(input.items, 1, [])) {
    if (item.type !== 'custom' && item.targetEntityType && item.targetEntityId) {
      await assertEntityExists(item.targetEntityType, item.targetEntityId)
    }
  }

  const rows: Array<{
    tempKey: number
    parentTempKey: number | null
    sortOrder: number
    type: string
    targetEntityType: string | null
    targetEntityId: number | null
    enabled: boolean
    openInNewTab: boolean
    rel: string | null
    label: string
    customUrl: string | null
    titleAttribute: string | null
    nofollow: boolean
    alias: string | null
  }> = []
  let seq = 0
  async function walk(nodes: NavigationTreeItemInput[], parentTempKey: number | null): Promise<void> {
    for (const [index, item] of nodes.entries()) {
      const tempKey = ++seq
      rows.push({
        tempKey,
        parentTempKey,
        sortOrder: item.sortOrder ?? index,
        type: item.type,
        targetEntityType: item.type === 'custom' || item.type === 'group' ? null : item.targetEntityType ?? null,
        targetEntityId: item.type === 'custom' || item.type === 'group' ? null : item.targetEntityId ?? null,
        enabled: item.enabled ?? true,
        openInNewTab: item.openInNewTab ?? false,
        rel: item.rel ?? null,
        label: item.label,
        alias: item.alias ?? null,
        customUrl: item.type === 'custom' ? item.customUrl ?? null : null,
        titleAttribute: item.titleAttribute ?? null,
        nofollow: item.nofollow ?? false
      })
      if (item.children?.length) await walk(item.children, tempKey)
    }
  }
  await walk(input.items, null)

  await replaceVariantItems(variantId, variant.localeId, rows)

  if (input.status) {
    await updateVariantStatus(variantId, input.status)
  }

  const location = (await findNavigationRow(variant.navigationId))?.location ?? ''
  const localeCode = (await listLocales()).find(l => l.id === variant.localeId)?.code ?? 'zh-CN'
  await invalidateNavigationCache(location, localeCode)
}

export async function getNavigationVariantTree(navigationId: number, localeCode: string): Promise<{
  variant: NavigationVariantMeta
  items: Awaited<ReturnType<typeof listVariantItems>>
  localeCode: string
} | undefined> {
  const locales = await listLocales()
  const localeId = locales.find(l => l.code === localeCode)?.id
  if (!localeId) return undefined
  const variant = await findVariant(navigationId, localeId)
  if (!variant) return undefined
  return { variant, items: await listVariantItems(variant.id), localeCode }
}

export async function createNavigationVariant(navigationId: number, body: {
  localeCode?: string
  copyFromVariantId?: number
}): Promise<NavigationVariantMeta> {
  const navigation = await findNavigationRow(navigationId)
  if (!navigation) {
    throw createError({ statusCode: 404, statusMessage: `Navigation #${navigationId} not found` })
  }
  const locales = await listLocales()
  const localeCode = body.localeCode ?? ''
  const localeId = locales.find(l => l.code === localeCode)?.id
  if (!localeId) {
    throw createError({ statusCode: 422, statusMessage: `Unknown locale "${localeCode}"` })
  }
  if (await findVariant(navigationId, localeId)) {
    throw createError({
      statusCode: 409,
      statusMessage: `A ${navigation.location} variant for ${localeCode} already exists`
    })
  }
  const copyFrom = body.copyFromVariantId
  if (copyFrom) {
    const source = await findVariantById(copyFrom)
    if (!source || source.navigationId !== navigationId) {
      throw createError({ statusCode: 422, statusMessage: 'copyFromVariantId must belong to the same navigation' })
    }
  }
  const isDefault = navigation.variants.length === 0
  const variantId = await insertVariant({ navigationId, localeId, isDefault })
  if (copyFrom) {
    await copyVariantItems(copyFrom, variantId, localeId, localeId === (locales.find(l => l.isDefault)?.id ?? locales[0]?.id))
  }
  const variant = await findVariantById(variantId)
  if (!variant) throw createError({ statusCode: 500, statusMessage: 'Variant disappeared after create' })
  return variant
}

export async function duplicateNavigationVariant(variantId: number, targetLocaleCode: string): Promise<NavigationVariantMeta> {
  const source = await findVariantById(variantId)
  if (!source) {
    throw createError({ statusCode: 404, statusMessage: `Variant #${variantId} not found` })
  }
  return createNavigationVariant(source.navigationId, {
    localeCode: targetLocaleCode,
    copyFromVariantId: variantId
  })
}

export async function deleteNavigationVariant(variantId: number): Promise<void> {
  const variant = await findVariantById(variantId)
  if (!variant) {
    throw createError({ statusCode: 404, statusMessage: `Variant #${variantId} not found` })
  }
  await deleteVariant(variantId)
}

export async function updateNavigationMeta(id: number, body: { adminName?: string, enabled?: boolean }): Promise<void> {
  const navigation = await findNavigationRow(id)
  if (!navigation) {
    throw createError({ statusCode: 404, statusMessage: `Navigation #${id} not found` })
  }
  if (body.enabled === false) {
    // disabling a navigation hides all its variants from the public site
    for (const variant of navigation.variants) {
      await deleteVariant(variant.id)
    }
  }
  await updateNavigationMetaRow(id, body)
  const localeCodes = (await listLocales()).map(l => l.code)
  for (const code of localeCodes) {
    invalidateNavigationCache(navigation.location, code)
  }
}

export { listNavigations, findNavigationRow }

/* ---------------- public resolution (§7.3) ---------------- */

export async function resolveNavigation(location: string, localeCode: string): Promise<PublicNavigation> {
  const cacheKey = `navigation:${location}:${localeCode}`
  if (isDomainDbReady()) {
    try {
      const cached = await getKV().get(cacheKey) as string | null
      if (cached) return JSON.parse(cached) as PublicNavigation
    } catch {
      // cache miss errors fall through to resolution
    }
  }

  const resolved = await resolveNavigationUncached(location, localeCode)
  if (isDomainDbReady()) {
    void getKV().set(cacheKey, JSON.stringify(resolved), CACHE_TTL_SECONDS).catch(() => undefined)
  }
  return resolved
}

async function resolveNavigationUncached(location: string, localeCode: string): Promise<PublicNavigation> {
  const empty: PublicNavigation = { location, locale: localeCode, fallbackUsed: false, items: [] }
  if (!isDomainDbReady()) return empty

  const navigation = await findNavigationByLocation(location)
  if (!navigation || !navigation.enabled) return empty

  const locales = await listLocales()
  const localeId = locales.find(l => l.code === localeCode)?.id
  const defaultLocaleId = locales.find(l => l.isDefault)?.id

  let variant = localeId ? await findVariant(navigation.id, localeId) : undefined
  let fallbackUsed = false
  if (!variant) {
    const defaultVariant = defaultLocaleId
      ? await findVariant(navigation.id, defaultLocaleId)
      : undefined
    if (!defaultVariant) return empty
    variant = defaultVariant
    fallbackUsed = true
  }
  if (variant.status === 'disabled') return { ...empty, fallbackUsed }

  const items = await listVariantItems(variant.id)
  const resolved = await resolveItems(items, null, (localeId ?? defaultLocaleId) as number, localeCode, fallbackUsed)
  return { location, locale: localeCode, fallbackUsed, items: resolved }
}

async function resolveItems(
  items: Awaited<ReturnType<typeof listVariantItems>>,
  parentId: number | null,
  localeId: number,
  localeCode: string,
  fallbackUsed: boolean
): Promise<PublicNavigationItem[]> {
  const result: PublicNavigationItem[] = []
  for (const item of items.filter(i => i.parentId === parentId)) {
    const resolved = await resolveItem(item, localeId, localeCode, fallbackUsed)
    if (!resolved) continue
    result.push({ ...resolved, children: await resolveItems(items, item.id, localeId, localeCode, fallbackUsed) })
  }
  return result
}

async function resolveItem(item: Awaited<ReturnType<typeof listVariantItems>>[number], localeId: number, localeCode: string, fallbackUsed: boolean): Promise<PublicNavigationItem | undefined> {
  let url: string | null = null
  let alias: string | null = null
  if (item.type === 'group') {
    return {
      label: resolveDisplayLabel({ locale: localeCode, defaultLabel: item.label ?? '', localizedLabel: fallbackUsed ? '' : item.label, alias: item.alias, systemKey: `group-${item.id}` }),
      url: '#',
      titleAttribute: item.titleAttribute,
      target: null,
      rel: null,
      children: []
    }
  }
  if (item.type === 'custom') {
    url = item.customUrl
    if (!url) return undefined
    alias = customUrlAlias(url) ?? null
  } else if (item.targetEntityType && item.targetEntityId) {
    if (item.targetEntityType === 'page') {
      alias = await findPublishedPageAliasById(item.targetEntityId, localeId)
      url = alias ? contentUrl('page', alias) : null
    } else if (item.targetEntityType === 'post') {
      alias = await findPublishedPostAliasById(item.targetEntityId, localeId)
      url = alias ? contentUrl('post', alias) : null
    } else if (item.targetEntityType === 'category' || item.targetEntityType === 'tag') {
      alias = await findTaxonomyAliasById(item.targetEntityType, item.targetEntityId)
      url = alias ? contentUrl('category', alias) : null
    }
    if (!url) return undefined // missing/unpublished translation in this locale
  } else {
    return undefined
  }

  const relParts = [item.rel, item.nofollow ? 'nofollow' : null].filter(Boolean)
  return {
    label: resolveDisplayLabel({ locale: localeCode, defaultLabel: item.label ?? '', localizedLabel: fallbackUsed ? '' : item.label, alias: alias ?? undefined, systemKey: `${item.type}-${item.targetEntityId ?? item.id}` }),
    url,
    titleAttribute: item.titleAttribute,
    target: item.type === 'custom' ? null : { type: item.targetEntityType ?? '', alias },
    rel: relParts.length > 0 ? relParts.join(' ') : null,
    children: []
  }
}

/** Internal custom links have no entity row to provide an alias. Derive the
 * stable last path segment so English navigation can use `about`, `posts`,
 * or `home` when its optional English label is empty. External URLs keep the
 * configured label because their host is not a project alias. */
function customUrlAlias(url: string): string | undefined {
  if (!url.startsWith('/') || url.startsWith('//')) return undefined
  const path = url.split(/[?#]/u, 1)[0]?.replace(/^\/+|\/+$/gu, '') ?? ''
  if (!path) return 'home'
  return path.split('/').filter(Boolean).at(-1)
}

/* ---------------- seed ---------------- */

export async function ensureDefaultNavigations(): Promise<void> {
  if (!isDomainDbReady()) return
  const locales = await listLocales()
  const defaultLocale = locales.find(l => l.isDefault) ?? locales[0]
  if (!defaultLocale) return

  const locations: Array<{ location: string, adminName: string, key: string }> = [
    { location: 'header', adminName: 'Main Navigation', key: 'header-menu' },
    { location: 'footer', adminName: 'Footer', key: 'footer-menu' }
  ]
  for (const definition of locations) {
    // per-variant completion: partially seeded or wiped states heal on reboot
    const navigation = await findNavigationByLocation(definition.location)
      ?? await createNavigationRow(definition)
    const hasVariant = navigation.variants.some(v => v.localeId === defaultLocale.id)
    let createdDefaultVariant = false
    if (!hasVariant) {
      const variantId = await insertVariant({ navigationId: navigation.id, localeId: defaultLocale.id, isDefault: true })
      createdDefaultVariant = true
      await replaceVariantItems(variantId, defaultLocale.id, [
        { tempKey: 1, parentTempKey: null, sortOrder: 0, type: 'custom', targetEntityType: null, targetEntityId: null, enabled: true, openInNewTab: false, rel: null, label: '首页', alias: 'home', customUrl: '/', titleAttribute: null, nofollow: false }
      ])
    }
    const variant = await findVariant(navigation.id, defaultLocale.id)
    if (variant && createdDefaultVariant) await ensureAdvertisingMenuItem(variant.id, defaultLocale.code)
  }
  console.log('[blog-db] navigations ready')
}

async function ensureAdvertisingMenuItem(variantId: number, localeCode: string): Promise<void> {
  const items = await listVariantItems(variantId)
  if (items.some(item => item.type === 'custom' && item.customUrl === '/advertising')) return

  const tempById = new Map<number, number>()
  const rows = items.map((item, index) => {
    const tempKey = index + 1
    tempById.set(item.id, tempKey)
    return {
      tempKey,
      parentTempKey: item.parentId === null ? null : tempById.get(item.parentId) ?? null,
      sortOrder: item.sortOrder,
      type: item.type,
      targetEntityType: item.targetEntityType,
      targetEntityId: item.targetEntityId,
      enabled: item.enabled,
      openInNewTab: item.openInNewTab,
      rel: item.rel,
      label: item.label ?? '',
      alias: item.alias ?? null,
      customUrl: item.customUrl,
      titleAttribute: item.titleAttribute,
      nofollow: item.nofollow
    }
  })
  rows.push({
    tempKey: rows.length + 1,
    parentTempKey: null,
    sortOrder: rows.length,
    type: 'custom',
    targetEntityType: null,
    targetEntityId: null,
    enabled: true,
    openInNewTab: false,
    rel: null,
    label: localeCode.toLowerCase().startsWith('en') ? 'Advertise' : '广告位购买',
    alias: 'advertising',
    customUrl: '/advertising',
    titleAttribute: null,
    nofollow: false
  })
  await replaceVariantItems(variantId, (await listLocales()).find(locale => locale.code === localeCode)?.id ?? 1, rows)
}

async function createNavigationRow(definition: { location: string, adminName: string, key: string }): Promise<NavigationRecord> {
  const id = await insertNavigation(definition)
  const navigation = await findNavigationRow(id)
  if (!navigation) throw new Error('navigation seed disappeared')
  return navigation
}
