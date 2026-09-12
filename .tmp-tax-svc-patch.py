import io, re

P = 'server/modules/taxonomy/taxonomy.service.ts'
with io.open(P, encoding='utf-8') as f:
    content = f.read()

def sub(pattern, replacement):
    global content
    new, n = re.subn(pattern, replacement, content, count=1)
    assert n == 1, 'FAIL ' + pattern[:70]
    content = new

# imports: alias helpers instead of ensureSlug
sub(r"import \{ ensureSlug, taxonomyInputSchema, type TaxonomyInput \} from '#shared/schemas/post'",
    "import { assertValidAlias, ensureAlias, isReservedAlias, taxonomyInputSchema, type TaxonomyInput } from '#shared/schemas/post'")

# translation rows: no slug (label only rows keep name; drop slug field)
sub(r"export interface TaxonomyTranslationRow \{\n  localeId: number\n  name: string\n  slug: string\n  description: string\n\}",
    "export interface TaxonomyTranslationRow {\n  localeId: number\n  name: string\n  description: string\n}")
sub(r"function translationValue\(row: \{ name: string, slug: string, description: string \}\): Record<string, unknown> \{\n  return \{ name: row\.name, slug: row\.slug, description: row\.description \}\n\}",
    "function translationValue(row: { name: string, description: string }): Record<string, unknown> {\n  return { name: row.name, description: row.description }\n}")

# buildRows: alias on entity, translations without slug; uniqueness on entity alias
sub(r"async function buildRows\(\n  kind: TaxonomyKind,\n  translations: NonNullable<TaxonomyInput\['translations'\]>,\n  excludeId\?: number\n\): Promise<TaxonomyTranslationRow\[\]> \{",
    "async function buildRows(\n  kind: TaxonomyKind,\n  translations: NonNullable<TaxonomyInput['translations']>,\n  excludeId?: number\n): Promise<TaxonomyTranslationRow[]> {")
sub(r"  const takenSlugs = new Set<string>\(\)\n  for \(const term of existing\) \{\n    for \(const \[code, fields\] of Object\.entries\(term\.translations\)\) \{\n      takenSlugs\.add\(`\$\{code\}:\$\{String\(fields\.slug \?\? ''\)\}`\)\n    \}\n  \}",
    "  const takenAliases = new Set(existing.map(t => t.translations && t.alias).filter((a): a is string => typeof a === 'string'))")
sub(r"    const slug = ensureSlug\(fields\.name, fields\.slug\)\n    if \(takenSlugs\.has\(`\$\{code\}:\$\{slug\}`\)\) \{\n      throw createError\(\{ statusCode: 409, statusMessage: `Slug \"\$\{slug\}\" already exists for \$\{code\}` \}\)\n    \}\n    rows\.push\(\{\n      localeId,\n      name: fields\.name,\n      slug,\n      description: fields\.description \?\? ''\n    \}\)",
    "    rows.push({\n      localeId,\n      name: fields.name,\n      description: fields.description ?? ''\n    })")

# create: alias resolution + uniqueness
sub(r"  const input = parse\(body\)\n  const id = await insertTaxonomy\(kind, await buildRows\(kind, input\.translations\)\)",
    """  const input = parse(body)
  const primaryTranslation = Object.values(input.translations)[0]
  const alias = ensureAlias(primaryTranslation.name, input.alias)
  if (isReservedAlias(alias)) {
    throw createError({ statusCode: 422, statusMessage: `Alias \"${alias}\" is a reserved path` })
  }
  const existingTerms = await listTaxonomyItems(kind)
  if (existingTerms.some(t => t.alias === alias)) {
    throw createError({ statusCode: 409, statusMessage: `Alias \"${alias}\" already exists` })
  }
  const id = await insertTaxonomy(kind, alias, await buildRows(kind, input.translations))""")

# update: alias optional change
sub(r"  const input = parse\(body\)\n  await updateTaxonomy\(kind, id, await buildRows\(kind, input\.translations, id\)\)",
    """  const input = parse(body)
  await updateTaxonomy(kind, id, input.alias, await buildRows(kind, input.translations, id))""")

# listTaxonomyItems should expose alias: it returns TaxonomyRecord without alias... extend record
sub(r"export async function listTaxonomyItems\(kind: TaxonomyKind\): Promise<TaxonomyRecord\[\]> \{\n  return withCodeKeyedTranslationsAll\(await listTaxonomy\(kind\)\)\n\}",
    "export async function listTaxonomyItems(kind: TaxonomyKind): Promise<TaxonomyRecord[]> {\n  return withCodeKeyedTranslationsAll(await listTaxonomy(kind))\n}\n\nexport async function findTaxonomyIdByAlias(kind: TaxonomyKind, alias: string): Promise<number | null> {\n  const terms = await listTaxonomyItems(kind)\n  const found = terms.find(t => t.alias === alias)\n  return found ? found.id : null\n}")

# publicTerms: alias field
sub(r"export async function publicTerms\(kind: TaxonomyKind, localeId: number\): Promise<PublicTaxonomyTerm\[\]> \{\n  const all = await listTaxonomy\(kind\)\n  const terms = await termsForLocale\(kind, localeId, all\.map\(t => t\.id\)\)\n  return all\n    \.map\(t => terms\.get\(t\.id\)\)\n    \.filter\(\(t\): t is \{ name: string, slug: string \} => t !== undefined\)\n\}",
    "export async function publicTerms(kind: TaxonomyKind, localeId: number): Promise<PublicTaxonomyTerm[]> {\n  const all = await listTaxonomy(kind)\n  const terms = await termsForLocale(kind, localeId, all.map(t => t.id))\n  return all\n    .map(t => terms.get(t.id))\n    .filter((t): t is { name: string, alias: string } => t !== undefined)\n}")

with io.open(P, 'w', encoding='utf-8', newline='\n') as f:
    f.write(content)
print('taxonomy.service ok')
