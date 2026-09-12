import { createError } from 'h3'
import {
  ensureAlias,
  isReservedAlias,
  taxonomyInputSchema,
  type TaxonomyInput
} from '#shared/schemas/post'
import type { PublicTaxonomyTerm } from '#shared/types/post'
import { isDomainDbReady } from '../../repositories/domain-status'
import { listLocales } from '../../repositories/locale.runtime.repository'
import { bumpAiDomains } from '../ai/optimization/invalidate'
import {
  deleteTaxonomy,
  findTaxonomyRow,
  insertTaxonomy,
  listTaxonomy,
  termsForLocale,
  updateTaxonomy,
  type TaxonomyKind,
  type TaxonomyRecord,
  type TaxonomyTranslationRow
} from '../../repositories/taxonomy.runtime.repository'
import { withCodeKeyedTranslationsAll } from '../../utils/translations'

/* Taxonomy domain service (P04 + alias unification): categories/tags
   share one shape. Alias is entity-level and locale-independent. */

export type { TaxonomyKind, TaxonomyRecord }

function parse(body: unknown): TaxonomyInput {
  const result = taxonomyInputSchema.safeParse(body)
  if (!result.success) {
    throw createError({
      statusCode: 422,
      statusMessage: result.error.issues[0]?.message ?? 'Invalid input'
    })
  }
  return result.data
}

async function buildRows(
  translations: NonNullable<TaxonomyInput['translations']>
): Promise<TaxonomyTranslationRow[]> {
  const locales = await listLocales()
  const codeToId = new Map(locales.map(l => [l.code, l.id]))
  const rows: TaxonomyTranslationRow[] = []
  for (const [code, fields] of Object.entries(translations)) {
    const localeId = codeToId.get(code)
    if (!localeId) {
      throw createError({ statusCode: 422, statusMessage: `Unknown locale "${code}"` })
    }
    rows.push({
      localeId,
      name: fields.name,
      description: fields.description ?? ''
    })
  }
  return rows
}

export async function createTaxonomyItem(kind: TaxonomyKind, body: unknown): Promise<TaxonomyRecord> {
  if (!isDomainDbReady()) {
    throw createError({ statusCode: 503, statusMessage: 'Database unavailable' })
  }
  const input = parse(body)
  const primaryName = Object.values(input.translations)[0]?.name ?? ''
  const alias = ensureAlias(primaryName, input.alias)
  if (isReservedAlias(alias)) {
    throw createError({ statusCode: 422, statusMessage: `Alias "${alias}" is a reserved path` })
  }
  if ((await listTaxonomyItems(kind)).some(t => t.alias === alias)) {
    throw createError({ statusCode: 409, statusMessage: `Alias "${alias}" already exists` })
  }
  const id = await insertTaxonomy(kind, alias, await buildRows(input.translations))
  const created = (await listTaxonomy(kind)).find(t => t.id === id)
  if (!created) throw createError({ statusCode: 500, statusMessage: 'Term disappeared after create' })
  await bumpAiDomains(['taxonomy'])
  const [withCodes] = await withCodeKeyedTranslationsAll([created])
  if (!withCodes) throw createError({ statusCode: 500, statusMessage: 'Term disappeared after create' })
  return withCodes
}

export async function updateTaxonomyItem(kind: TaxonomyKind, id: number, body: unknown): Promise<TaxonomyRecord> {
  const existing = (await listTaxonomy(kind)).find(t => t.id === id)
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: `${kind} #${id} not found` })
  }
  const input = parse(body)
  let alias = existing.alias
  if (input.alias !== undefined && input.alias !== existing.alias) {
    if (isReservedAlias(input.alias)) {
      throw createError({ statusCode: 422, statusMessage: `Alias "${input.alias}" is a reserved path` })
    }
    if ((await listTaxonomyItems(kind)).some(t => t.alias === input.alias && t.id !== id)) {
      throw createError({ statusCode: 409, statusMessage: `Alias "${input.alias}" already exists` })
    }
    alias = input.alias
  }
  await updateTaxonomy(kind, id, alias, await buildRows(input.translations))
  const updated = (await listTaxonomy(kind)).find(t => t.id === id)
  if (!updated) throw createError({ statusCode: 500, statusMessage: 'Term disappeared after update' })
  await bumpAiDomains(['taxonomy'])
  const [withCodes] = await withCodeKeyedTranslationsAll([updated])
  if (!withCodes) throw createError({ statusCode: 500, statusMessage: 'Term disappeared after update' })
  return withCodes
}

export async function deleteTaxonomyItem(kind: TaxonomyKind, id: number): Promise<void> {
  if (!(await findTaxonomyRow(kind, id))) {
    throw createError({ statusCode: 404, statusMessage: `${kind} #${id} not found` })
  }
  await deleteTaxonomy(kind, id)
  await bumpAiDomains(['taxonomy'])
}

export async function listTaxonomyItems(kind: TaxonomyKind): Promise<TaxonomyRecord[]> {
  return withCodeKeyedTranslationsAll(await listTaxonomy(kind))
}

/** resolve an entity alias to the term id (null when absent) */
export async function findTaxonomyIdByAlias(kind: TaxonomyKind, alias: string): Promise<number | null> {
  const terms = await listTaxonomyItems(kind)
  const found = terms.find(t => t.alias === alias)
  return found ? found.id : null
}

/** public term list for one locale (terms missing that locale are hidden) */
export async function publicTerms(kind: TaxonomyKind, localeId: number): Promise<PublicTaxonomyTerm[]> {
  const all = await listTaxonomy(kind)
  const terms = await termsForLocale(kind, localeId, all.map(t => t.id))
  return all
    .map(t => terms.get(t.id))
    .filter((t): t is { name: string, alias: string } => t !== undefined)
}
