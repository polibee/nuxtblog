import io, re

# ---------- page.service ----------
P = 'server/modules/pages/page.service.ts'
with io.open(P, encoding='utf-8') as f:
    content = f.read()

def sub(pattern, replacement):
    global content
    new, n = re.subn(pattern, replacement, content, count=1)
    assert n == 1, 'FAIL ' + pattern[:70]
    content = new

sub(r"import \{ ensureSlug, postSlugSchema \} from '#shared/schemas/post'",
    "import { assertValidAlias, ensureAlias } from '#shared/schemas/post'")
sub("findPublishedPageBySlug,", "findPublishedPageAliasById, findPublishedPageByAlias,")

# PageTranslationRow fields: no slug
sub(r"export const pageTranslationFieldsSchema = z\.object\(\{\n    title: z\.string\(\)\.trim\(\)\.min\(1\)\.max\(255\),\n    slug: postSlugSchema\.optional\(\),\n    content",
    "export const pageTranslationFieldsSchema = z.object({\n    title: z.string().trim().min(1).max(255),\n    content")

# input schema: alias on entity
sub(r"  \.object\(\{\n    status: z\.enum\(PAGE_STATUSES\)\.optional\(\),\n    template",
    "  .object({\n    alias: aliasSchema.optional(),\n    status: z.enum(PAGE_STATUSES).optional(),\n    template")
sub(r"import \{ assertValidAlias, ensureAlias \} from '#shared/schemas/post'",
    "import { aliasSchema, assertValidAlias, ensureAlias } from '#shared/schemas/post'")

# buildTranslationRows: no slug
sub(r"      title: fields\.title,\n      slug: ensureAlias\(fields\.title, fields\.slug\),\n      content: sanitizeRichText\(fields\.content \?\? ''\),",
    "      title: fields.title,\n      content: sanitizeRichText(fields.content ?? ''),")

# checkStatus: content complete only
sub(r"    const complete = Boolean\(\n      primary\n      && primary\.title\.trim\(\)\n      && primary\.slug\.trim\(\)\n      && primary\.content",
    "    const complete = Boolean(\n      primary\n      && primary.title.trim()\n      && primary.content")

# createPage: alias
sub(r"  const translations = await buildTranslationRows\(input\.translations, maps, 'create'\)\n  checkStatus\(status, translations, maps\.defaultId\)\n\n  const id = await insertPage\(\{\n    primaryLocaleId: maps\.defaultId,",
    "  const translations = await buildTranslationRows(input.translations, maps, 'create')\n  checkStatus(status, translations, maps.defaultId)\n\n"
    "  const alias = ensureAlias(translations?.find(t => t.localeId === maps.defaultId)?.title ?? '', input.alias)\n"
    "  if (isReservedAlias(alias)) {\n"
    "    throw createError({ statusCode: 422, statusMessage: `Alias \"${alias}\" is a reserved path` })\n"
    "  }\n"
    "  if (await findPageByAlias(alias)) {\n"
    "    throw createError({ statusCode: 409, statusMessage: `Alias \"${alias}\" already exists` })\n"
    "  }\n\n"
    "  const id = await insertPage({\n    alias,\n    primaryLocaleId: maps.defaultId,")

# imports for findPageByAlias
sub(r"import \{\n  deletePageRow,", "import {\n  deletePageRow,\n  findPageByAlias,")

# updatePage: alias change + redirect
sub(r"  const translations = await buildTranslationRows\(input\.translations, maps, 'update'\)\n  checkStatus\(status, translations, maps\.defaultId\)\n\n  const entityPatch: Parameters<typeof updatePageRow>\[1\] = \{\}\n  if \(input\.status !== undefined\) entityPatch\.status = input\.status",
    "  const translations = await buildTranslationRows(input.translations, maps, 'update')\n"
    "  checkStatus(status, translations, maps.defaultId)\n\n"
    "  let alias = existing.alias\n"
    "  if (input.alias !== undefined && input.alias !== existing.alias) {\n"
    "    if (isReservedAlias(input.alias)) {\n"
    "      throw createError({ statusCode: 422, statusMessage: `Alias \"${input.alias}\" is a reserved path` })\n"
    "    }\n"
    "    if (await findPageByAlias(input.alias)) {\n"
    "      throw createError({ statusCode: 409, statusMessage: `Alias \"${input.alias}\" already exists` })\n"
    "    }\n"
    "    if (existing.status === 'published') {\n"
    "      await recordUrlRedirect({\n"
    "        entityType: 'page',\n"
    "        entityId: existing.id,\n"
    "        oldPath: contentUrl('page', existing.alias),\n"
    "        newPath: contentUrl('page', input.alias)\n"
    "      })\n"
    "    }\n"
    "    alias = input.alias\n"
    "  }\n\n"
    "  const entityPatch: Parameters<typeof updatePageRow>[1] = {}\n"
    "  if (alias !== existing.alias) entityPatch.alias = alias\n"
    "  if (input.status !== undefined) entityPatch.status = input.status")

# imports for recordUrlRedirect/contentUrl + navigation cache invalidation
sub(r"import \{ sanitizeRichText \} from '../../utils/sanitize'",
    "import { sanitizeRichText } from '../../utils/sanitize'\n"
    "import { contentUrl, recordUrlRedirect } from '../../utils/contentUrl'\n"
    "import { invalidateAllNavigationCaches } from '../../utils/navigationCache'")

# updatePageRow write + invalidation
sub(r"  await updatePageRow\(id, entityPatch, translations\)\n  return finalize\(await getPage\(id\)\)\n\}\n\nexport async function deletePage",
    "  await updatePageRow(id, entityPatch, translations)\n"
    "  if (alias !== existing.alias) {\n"
    "    await invalidateAllNavigationCaches()\n"
    "  }\n"
    "  return finalize(await getPage(id))\n"
    "}\n\nexport async function deletePage")

# public read by alias
sub(r"export async function getPublicPage\(localeCode: string, slug: string\) \{\n  const locales = await listLocales\(\)\n  const localeId = locales\.find\(l => l\.code === localeCode\)\?\.id\n  if \(!localeId\) return undefined\n  return findPublishedPageBySlug\(localeId, slug\)\n\}",
    "export async function getPublicPageByAlias(localeCode: string, alias: string) {\n"
    "  const locales = await listLocales()\n"
    "  const localeId = locales.find(l => l.code === localeCode)?.id\n"
    "  if (!localeId) return undefined\n"
    "  return findPublishedPageByAlias(localeId, alias)\n}")

# listPublishedPages public shape: slug -> alias
sub(r"  return \{ pages: pages\.map\(p => \(\{ slug: p\.slug, title: p\.title \}\)\) \}",
    "  return { pages: pages.map(p => ({ alias: p.alias, title: p.title })) }")

with io.open(P, 'w', encoding='utf-8', newline='\n') as f:
    f.write(content)
print('page.service ok')

# ---------- public pages list endpoint shape ----------
Q = 'server/api/public/pages.get.ts'
with io.open(Q, encoding='utf-8') as f:
    content = f.read()
content = content.replace("{ slug: p.slug, title: p.title }", "{ alias: p.alias, title: p.title }")
with io.open(Q, 'w', encoding='utf-8', newline='\n') as f:
    f.write(content)
print('pages.get ok')
