import io, re

P = 'server/modules/posts/post.service.ts'
with io.open(P, encoding='utf-8') as f:
    content = f.read()

def sub_once(pattern, replacement):
    global content
    new, n = re.subn(pattern, replacement, content, count=1)
    assert n == 1, pattern[:70]
    content = new

# imports: alias helpers + contentUrl/redirects
sub_once(r"import \{\n  POST_STATUSES,",
         "import {\n  POST_STATUSES,\n  ensureAlias,\n  isReservedAlias,")
sub_once(r"import \{ sanitizeRichText \} from '../../utils/sanitize'",
         "import { sanitizeRichText } from '../../utils/sanitize'\nimport { contentUrl, recordUrlRedirect } from '../../utils/contentUrl'\nimport { invalidateAllNavigationCaches } from '../../utils/navigationCache'")

# AdminPost/PostRecord alias
sub_once(r"(export interface AdminPost extends PostRecord \{\n  title: string\n\}\n\n)",
         r"\1")

# buildTranslationRows: no slug
sub_once(r"      title: fields\.title,\n      slug: ensureSlug\(fields\.title, fields\.slug\),\n      excerpt: fields\.excerpt \?\? '',",
         "      title: fields.title,\n      excerpt: fields.excerpt ?? '',")

# checkStatus: drop slug completeness check
sub_once(r"  const primary = translations\?\.find\(t => t\.localeId === primaryLocaleId\)\n  if \(status === 'published'\) \{\n    const complete = Boolean\(\n      primary\n      && primary\.title\.trim\(\)\n      && primary\.slug\.trim\(\)\n      && primary\.content",
         "  const primary = translations?.find(t => t.localeId === primaryLocaleId)\n  if (status === 'published') {\n    const complete = Boolean(\n      primary\n      && primary.title.trim()\n      && primary.content")

# createPost: alias + uniqueness + reserved
sub_once(r"  const input = parseInput\(body\)\n  const maps = await localeMaps\(\)\n  const status = input\.status \?\? 'draft'\n  const translations = await buildTranslationRows\(input\.translations, maps, 'create'\)\n  checkStatus\(status, input, translations, maps\.defaultId\)",
         """  const input = parseInput(body)
  const maps = await localeMaps()
  const status = input.status ?? 'draft'
  const translations = await buildTranslationRows(input.translations, maps, 'create')
  checkStatus(status, input, translations, maps.defaultId)

  const alias = ensureAlias(translations?.find(t => t.localeId === maps.defaultId)?.title ?? '', input.alias)
  if (isReservedAlias(alias)) {
    throw createError({ statusCode: 422, statusMessage: `Alias "${alias}" is a reserved path` })
  }
  if (await findPostByAlias(alias)) {
    throw createError({ statusCode: 409, statusMessage: `Alias "${alias}" already exists` })
  }""")

sub_once(r"  const id = await insertPost\(\{\n    primaryLocaleId: maps\.defaultId,",
         "  const id = await insertPost({\n    alias,\n    primaryLocaleId: maps.defaultId,")

# updatePost: alias change handling + redirects + cache invalidation
sub_once(r"  const input = parseInput\(body\)\n  const maps = await localeMaps\(\)\n  const status = input\.status \?\? existing\.status\n  const translations = await buildTranslationRows\(input\.translations, maps, 'update'\)\n  checkStatus\(status, input, translations, maps\.defaultId\)",
         """  const input = parseInput(body)
  const maps = await localeMaps()
  const status = input.status ?? existing.status
  const translations = await buildTranslationRows(input.translations, maps, 'update')
  checkStatus(status, input, translations, maps.defaultId)

  let alias = existing.alias
  if (input.alias !== undefined && input.alias !== existing.alias) {
    if (isReservedAlias(input.alias)) {
      throw createError({ statusCode: 422, statusMessage: `Alias "${input.alias}" is a reserved path` })
    }
    if (await findPostByAlias(input.alias)) {
      throw createError({ statusCode: 409, statusMessage: `Alias "${input.alias}" already exists` })
    }
    if (existing.status === 'published') {
      // keep the old public URL alive via 301 (alias unification doc 3.3)
      await recordUrlRedirect({
        entityType: 'post',
        entityId: existing.id,
        oldPath: contentUrl('post', existing.alias),
        newPath: contentUrl('post', input.alias)
      })
    }
    alias = input.alias
  }""")

sub_once(r"  const entityPatch: Parameters<typeof updatePostRow>\[1\] = \{\}\n  if \(input\.status !== undefined\) entityPatch\.status = input\.status",
         "  const entityPatch: Parameters<typeof updatePostRow>[1] = {}\n  if (alias !== existing.alias) entityPatch.alias = alias\n  if (input.status !== undefined) entityPatch.status = input.status")

sub_once(r"  await updatePostRow\(id, entityPatch, translations\)",
         "  await updatePostRow(id, entityPatch, translations)\n  if (alias !== existing.alias) {\n    await invalidateAllNavigationCaches()\n  }")

# public reads: alias
sub_once(r"export async function getPublicPosts\(localeCode: string, options: \{",
         "export async function getPublicPosts(localeCode: string, options: {")
sub_once(r"  const result = await listPublished\(localeId, \{ page: options\.page, perPage: options\.perPage, postIds \}\)",
         "  const result = await listPublished(localeId, { page: options.page, perPage: options.perPage, postIds })")
sub_once(r"  const items = await Promise\.all\(result\.items\.map\(async \(row\) => \(\{\n    slug: row\.slug,",
         "  const items = await Promise.all(result.items.map(async (row) => ({\n    alias: row.alias,")

sub_once(r"export async function getPublicPost\(localeCode: string, slug: string\): Promise<PublicPostDetail \| undefined> \{",
         "export async function getPublicPostByAlias(localeCode: string, alias: string): Promise<PublicPostDetail | undefined> {")
sub_once(r"  const row = await findPublishedBySlug\(localeId, slug\)",
         "  const row = await findPublishedByAlias(localeId, alias)")
sub_once(r"  return \{\n    slug: row\.slug,\n    title: row\.title,",
         "  return {\n    alias: row.alias,\n    title: row.title,")

with io.open(P, 'w', encoding='utf-8', newline='\n') as f:
    f.write(content)
print('post.service ok')
