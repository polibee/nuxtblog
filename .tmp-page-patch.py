import io, re

P = 'server/repositories/page.repository.ts'
with io.open(P, encoding='utf-8') as f:
    content = f.read()

def sub_once(pattern, replacement):
    global content
    new, n = re.subn(pattern, replacement, content, count=1)
    assert n == 1, 'ANCHOR FAIL: ' + pattern[:70]
    content = new

# PageRecord alias
sub_once(r"(export interface PageRecord \{\n  id: number\n)  primaryLocaleCode",
         r"\1  alias: string\n  primaryLocaleCode")

# PageTranslationRow: no slug
sub_once(r"export interface PageTranslationRow \{\n  localeId: number\n  title: string\n  slug: string\n  content: string",
         "export interface PageTranslationRow {\n  localeId: number\n  title: string\n  content: string")

sub_once(r"  return \{\n    title: row\.title,\n    slug: row\.slug,\n    content: row\.content,",
         "  return {\n    title: row.title,\n    content: row.content,")

# listPages items alias
sub_once(r"(  const items = rows\.map\(row => \(\{\n    id: row\.id,\n)    primaryLocaleCode",
         r"\1    alias: row.alias,\n    primaryLocaleCode")

# getPage alias
sub_once(r"(export async function getPage\(id: number\): Promise<PageRecord \| undefined> \{[\s\S]*?return \{\n    id: row\.id,\n)    primaryLocaleCode",
         r"\1    alias: row.alias,\n    primaryLocaleCode")

# insertPage entity alias
sub_once(r"(export async function insertPage\(entity: \{\n)  primaryLocaleId: number",
         r"\1  alias: string\n  primaryLocaleId: number")

# updatePageRow patch alias
sub_once(r"(  entityPatch: Partial<\{\n)    primaryLocaleId: number",
         r"\1    alias: string\n    primaryLocaleId: number")

# PublishedPage: alias instead of slug
sub_once(r"(export interface PublishedPage \{\n  title: string\n)  slug: string", r"\1  alias: string")

# findPublishedPageBySlug -> ByAlias
sub_once(r"export async function findPublishedPageBySlug\(localeId: number, slug: string\): Promise<PublishedPage \| undefined> \{",
         "export async function findPublishedPageByAlias(localeId: number, alias: string): Promise<PublishedPage | undefined> {")
sub_once(r"(      eq\(pageTranslations\.localeId, localeId\),\n)      eq\(pageTranslations\.slug, slug\)",
         r"\1      eq(pages.alias, alias)")
sub_once(r"    \.select\(\{\n      title: pageTranslations\.title,\n      slug: pageTranslations\.slug,",
         "    .select({\n      title: pageTranslations.title,\n      alias: pages.alias,")
sub_once(r"    \.select\(\{\n      title: pageTranslations\.title,\n      slug: pageTranslations\.slug,",
         "    .select({\n      title: pageTranslations.title,\n      alias: pages.alias,")

# listPublishedPages: same select alias + filter no slug
sub_once(r"export async function listPublishedPages\(localeId: number\): Promise<PublishedPage\[\]> \{\n  const rows = await getDb\(\)\n    \.select\(\{\n      title: pageTranslations\.title,\n      slug: pageTranslations\.slug,",
         "export async function listPublishedPages(localeId: number): Promise<PublishedPage[]> {\n  const rows = await getDb()\n    .select({\n      title: pageTranslations.title,\n      alias: pages.alias,")

# findPublishedPageAliasById helper appended
content += """
/** alias of a published page in one locale (navigation reference resolution) */
export async function findPublishedPageAliasById(pageId: number, localeId: number): Promise<string | null> {
  const rows = await getDb()
    .select({ alias: pages.alias })
    .from(pages)
    .innerJoin(pageTranslations, eq(pageTranslations.pageId, pages.id))
    .where(and(
      eq(pages.id, pageId),
      eq(pages.status, 'published'),
      isNull(pages.deletedAt),
      eq(pageTranslations.localeId, localeId)
    ))
    .limit(1)
  return rows[0]?.alias ?? null
}

export async function findPageByAlias(alias: string): Promise<PageRecord | undefined> {
  const rows = await getDb()
    .select()
    .from(pages)
    .where(and(eq(pages.alias, alias), isNull(pages.deletedAt)))
    .limit(1)
  if (!rows[0]) return undefined
  return getPage(rows[0].id)
}
"""

with io.open(P, 'w', encoding='utf-8', newline='\n') as f:
    f.write(content)
print('page.repository ok')
