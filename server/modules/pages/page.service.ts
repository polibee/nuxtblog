import { createError } from 'h3'
import type { Paginated } from '#shared/types/api'
import { z } from 'zod'
import { aliasSchema, assertValidAlias, ensureAlias, isReservedAlias } from '#shared/schemas/post'
import { isDomainDbReady as isBlogDbReady } from '../../repositories/domain-status'
import { listLocales } from '../../repositories/locale.runtime.repository'
import { bumpAiDomains } from '../ai/optimization/invalidate'
import {
  deletePageRow,
  findPageByAlias,
  findPageRow,
  findPublishedPageByAlias,
  getPage,
  insertPage,
  listPages,
  updatePageRow,
  type PageRecord,
  type PageTranslationRow
} from '../../repositories/page.runtime.repository'
import { withCodeKeyedTranslations, withCodeKeyedTranslationsAll } from '../../utils/translations'
import { sanitizeRichText } from '../../utils/sanitize'
import { contentUrl, recordUrlRedirect } from '../../utils/contentUrl'
import { invalidateAllNavigationCaches } from '../../utils/navigationCache'

/* Page domain service (P05 + alias unification): Entity-level alias is
   the stable public identifier; translations carry human-readable
   content only. Alias changes on published pages record a 301. */

export type { PageRecord }

export interface AdminPage extends PageRecord {
  title: string
}

export const PAGE_STATUSES = ['draft', 'published', 'archived'] as const

export const pageTranslationFieldsSchema = z.object({
  title: z.string().trim().min(1).max(255),
  content: z.string().optional(),
  seoTitle: z.string().max(255).optional(),
  seoDescription: z.string().max(500).optional(),
  canonicalUrl: z.string().trim().url().max(500).nullish(),
  noindex: z.boolean().optional()
})

export const pageInputSchema = z
  .object({
    alias: aliasSchema.optional(),
    status: z.enum(PAGE_STATUSES).optional(),
    template: z.string().trim().max(40).optional(),
    translations: z.record(z.string(), pageTranslationFieldsSchema).optional()
  })
  .strict()

export type PageInput = z.infer<typeof pageInputSchema>

interface LocaleMaps {
  codeToId: Map<string, number>
  defaultCode: string
  defaultId: number
}

async function localeMaps(): Promise<LocaleMaps> {
  const locales = await listLocales()
  const defaultLocale = locales.find(l => l.isDefault) ?? locales[0]
  if (!defaultLocale) {
    throw createError({ statusCode: 503, statusMessage: 'Locale registry unavailable' })
  }
  return {
    codeToId: new Map(locales.map(l => [l.code, l.id])),
    defaultCode: defaultLocale.code,
    defaultId: defaultLocale.id
  }
}

function previewTitle(record: PageRecord): string {
  const primary = record.translations[record.primaryLocaleCode] as
    | { title?: unknown }
    | undefined
  return String(primary?.title ?? Object.values(record.translations)[0]?.title ?? '')
}

function parseInput(body: unknown): Partial<PageInput> {
  const result = pageInputSchema.safeParse(body)
  if (!result.success) {
    throw createError({
      statusCode: 422,
      statusMessage: result.error.issues[0]?.message ?? 'Invalid input'
    })
  }
  return result.data
}

async function buildTranslationRows(
  translations: NonNullable<PageInput['translations']> | undefined,
  maps: LocaleMaps,
  mode: 'create' | 'update'
): Promise<PageTranslationRow[] | undefined> {
  if (!translations || (mode === 'create' && Object.keys(translations).length === 0)) {
    if (mode === 'create') {
      throw createError({ statusCode: 422, statusMessage: 'At least one locale translation is required' })
    }
    return undefined
  }
  return Object.entries(translations).map(([code, fields]) => {
    const localeId = maps.codeToId.get(code)
    if (!localeId) {
      throw createError({ statusCode: 422, statusMessage: `Unknown locale "${code}"` })
    }
    return {
      localeId,
      title: fields.title,
      content: sanitizeRichText(fields.content ?? ''),
      seoTitle: fields.seoTitle ?? '',
      seoDescription: fields.seoDescription ?? '',
      canonicalUrl: fields.canonicalUrl ?? null,
      noindex: fields.noindex ?? false
    }
  })
}

function checkStatus(
  status: PageInput['status'],
  translations: PageTranslationRow[] | undefined,
  primaryLocaleId: number,
  existingTranslations?: PageRecord['translations']
): void {
  if (status !== 'published') return
  const primary = translations?.find(t => t.localeId === primaryLocaleId)
    ?? existingTranslations?.[String(primaryLocaleId)] as PageTranslationRow | undefined
  const complete = Boolean(
    primary
    && primary.title.trim()
  )
  if (!complete) {
    throw createError({
      statusCode: 422,
      statusMessage: 'Publishing requires a primary-locale title'
    })
  }
}

async function finalize(page: PageRecord | undefined): Promise<AdminPage> {
  if (!page) throw createError({ statusCode: 500, statusMessage: 'Page disappeared after write' })
  const withCodes = await withCodeKeyedTranslations(page) as AdminPage
  withCodes.title = previewTitle(withCodes)
  return withCodes
}

export async function createPage(body: unknown, authorId: number): Promise<AdminPage> {
  if (!isBlogDbReady()) {
    throw createError({ statusCode: 503, statusMessage: 'Database unavailable' })
  }
  const input = parseInput(body)
  const maps = await localeMaps()
  const status = input.status ?? 'draft'
  const translations = await buildTranslationRows(input.translations, maps, 'create')
  checkStatus(status, translations, maps.defaultId)

  const alias = ensureAlias(translations?.find(t => t.localeId === maps.defaultId)?.title ?? '', input.alias)
  if (isReservedAlias(alias)) {
    throw createError({ statusCode: 422, statusMessage: `Alias "${alias}" is a reserved path` })
  }
  if (await findPageByAlias(alias)) {
    throw createError({ statusCode: 409, statusMessage: `Alias "${alias}" already exists` })
  }

  const id = await insertPage({
    alias,
    primaryLocaleId: maps.defaultId,
    authorId,
    template: input.template ?? 'default',
    status,
    publishedAt: status === 'published' ? new Date() : null
  }, translations!)
  await bumpAiDomains(['pages'])
  return finalize(await getPage(id))
}

export async function updatePage(id: number, body: unknown): Promise<AdminPage> {
  const existing = await getPage(id)
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: `Page #${id} not found` })
  }
  const input = parseInput(body)
  const maps = await localeMaps()
  const status = input.status ?? existing.status
  const translations = await buildTranslationRows(input.translations, maps, 'update')
  checkStatus(status, translations, maps.defaultId, existing.translations)

  let alias = existing.alias
  if (input.alias !== undefined && input.alias !== existing.alias) {
    assertValidAlias(input.alias)
    if (isReservedAlias(input.alias)) {
      throw createError({ statusCode: 422, statusMessage: `Alias "${input.alias}" is a reserved path` })
    }
    if (await findPageByAlias(input.alias)) {
      throw createError({ statusCode: 409, statusMessage: `Alias "${input.alias}" already exists` })
    }
    if (existing.status === 'published') {
      await recordUrlRedirect({
        entityType: 'page',
        entityId: existing.id,
        oldPath: contentUrl('page', existing.alias),
        newPath: contentUrl('page', input.alias)
      })
    }
    alias = input.alias
  }

  const entityPatch: Parameters<typeof updatePageRow>[1] = {}
  if (alias !== existing.alias) entityPatch.alias = alias
  if (input.status !== undefined) entityPatch.status = input.status
  if (input.template !== undefined) entityPatch.template = input.template
  if (input.status !== undefined) {
    const wasPublished = existing.status === 'published'
    if (input.status === 'published' && !wasPublished) entityPatch.publishedAt = new Date()
    if (input.status !== 'published' && wasPublished) entityPatch.publishedAt = null
  }

  await updatePageRow(id, entityPatch, translations)
  if (alias !== existing.alias) {
    await invalidateAllNavigationCaches()
  }
  await bumpAiDomains(['pages'])
  return finalize(await getPage(id))
}

export async function deletePage(id: number): Promise<void> {
  if (!(await findPageRow(id))) {
    throw createError({ statusCode: 404, statusMessage: `Page #${id} not found` })
  }
  await deletePageRow(id)
  await bumpAiDomains(['pages'])
}

export async function getPageItem(id: number): Promise<AdminPage> {
  const page = await getPage(id)
  if (!page) {
    throw createError({ statusCode: 404, statusMessage: `Page #${id} not found` })
  }
  return finalize(page)
}

export async function listPageItems(query: Parameters<typeof listPages>[0]): Promise<Paginated<AdminPage>> {
  const result = await listPages(query)
  const items = (await withCodeKeyedTranslationsAll(result.items)) as AdminPage[]
  for (const item of items) item.title = previewTitle(item)
  return { ...result, items }
}

/* ---------------- public reads ---------------- */

export async function getPublicPageByAlias(localeCode: string, alias: string) {
  const locales = await listLocales()
  const localeId = locales.find(l => l.code === localeCode)?.id
  if (!localeId) return undefined
  return findPublishedPageByAlias(localeId, alias)
}
