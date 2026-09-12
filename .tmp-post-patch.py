import io

def patch(path, old, new, count=1):
    with io.open(path, encoding='utf-8') as f:
        content = f.read()
    assert old in content, path + ': ' + old[:70]
    content = content.replace(old, new, count)
    with io.open(path, 'w', encoding='utf-8', newline='\n') as f:
        f.write(content)

P = 'server/repositories/post.repository.ts'

# entity alias on records
patch(P,
      "export interface PostRecord {\n  id: number\n  primaryLocaleCode: string",
      "export interface PostRecord {\n  id: number\n  alias: string\n  primaryLocaleCode: string")

# translation rows: no slug
patch(P,
      "export interface PostTranslationRow {\n  localeId: number\n  title: string\n  slug: string\n  excerpt: string",
      "export interface PostTranslationRow {\n  localeId: number\n  title: string\n  excerpt: string")

patch(P,
      "  return {\n    title: row.title,\n    slug: row.slug,\n    excerpt: row.excerpt,",
      "  return {\n    title: row.title,\n    excerpt: row.excerpt,")

# listPosts items carry alias
patch(P,
      "  const items = await Promise.all(rows.map(async (row) => ({\n    id: row.id,\n    primaryLocaleCode: codeById.get(row.primaryLocaleId) ?? 'zh-CN',",
      "  const items = await Promise.all(rows.map(async (row) => ({\n    id: row.id,\n    alias: row.alias,\n    primaryLocaleCode: codeById.get(row.primaryLocaleId) ?? 'zh-CN',")

# getPost record carries alias
patch(P,
      "  return {\n    id: row.id,\n    primaryLocaleCode: localeRows.find(l => l.id === row.primaryLocaleId)?.code ?? 'zh-CN',",
      "  return {\n    id: row.id,\n    alias: row.alias,\n    primaryLocaleCode: localeRows.find(l => l.id === row.primaryLocaleId)?.code ?? 'zh-CN',")

# insertPost entity: alias column
patch(P,
      "export async function insertPost(entity: {\n  primaryLocaleId: number\n  authorId: number",
      "export async function insertPost(entity: {\n  alias: string\n  primaryLocaleId: number\n  authorId: number")

# updatePostRow patch may change alias
patch(P,
      "  entityPatch: Partial<{\n    primaryLocaleId: number\n    featuredMediaId: number | null\n    accessType: string",
      "  entityPatch: Partial<{\n    alias: string\n    primaryLocaleId: number\n    featuredMediaId: number | null\n    accessType: string")

# published query: alias instead of slug
patch(P,
      "export interface PublishedTranslation {\n  postId: number\n  title: string\n  slug: string\n  excerpt: string",
      "export interface PublishedTranslation {\n  postId: number\n  title: string\n  alias: string\n  excerpt: string")

patch(P,
      "      postId: posts.id,\n      title: postTranslations.title,\n      slug: postTranslations.slug,\n      excerpt: postTranslations.excerpt,",
      "      postId: posts.id,\n      title: postTranslations.title,\n      alias: posts.alias,\n      excerpt: postTranslations.excerpt,")

patch(P,
      "    .map(row => ({\n        postId: row.postId,\n        title: row.title,\n        slug: row.slug,\n        excerpt: row.excerpt,",
      "    .map(row => ({\n        postId: row.postId,\n        title: row.title,\n        alias: row.alias,\n        excerpt: row.excerpt,")

# findPublishedBySlug -> findPublishedByAlias
patch(P,
      "export async function findPublishedBySlug(localeId: number, slug: string): Promise<PublishedTranslation | undefined> {",
      "export async function findPublishedByAlias(localeId: number, alias: string): Promise<PublishedTranslation | undefined> {")
patch(P,
      "      eq(postTranslations.localeId, localeId),\n      eq(postTranslations.slug, slug)\n    ))\n    .limit(1)",
      "      eq(postTranslations.localeId, localeId),\n      eq(posts.alias, alias)\n    ))\n    .limit(1)")
patch(P,
      "  return {\n    postId: row.postId,\n    title: row.title,\n    slug: row.slug,\n    excerpt: row.excerpt,",
      "  return {\n    postId: row.postId,\n    title: row.title,\n    alias: row.alias,\n    excerpt: row.excerpt,")

# slug-by-id helper becomes alias-by-id
patch(P,
      "/** slug of a published post in one locale (navigation reference resolution) */\nexport async function findPublishedPostSlugById(postId: number, localeId: number): Promise<string | null> {\n  const rows = await getDb()\n    .select({ slug: postTranslations.slug })",
      "/** alias of a published post in one locale (navigation reference resolution) */\nexport async function findPublishedPostAliasById(postId: number, localeId: number): Promise<string | null> {\n  const rows = await getDb()\n    .select({ alias: posts.alias })")

patch(P,
      "      eq(postTranslations.localeId, localeId)\n    ))\n    .limit(1)\n  return rows[0]?.slug ?? null\n}",
      "      eq(postTranslations.localeId, localeId)\n    ))\n    .limit(1)\n  return rows[0]?.alias ?? null\n}")

# findPostByAlias for uniqueness + public lookups
patch(P,
      "export async function deletePostRow(id: number): Promise<void> {\n  await getDb().delete(posts).where(eq(posts.id, id))\n}",
      "export async function deletePostRow(id: number): Promise<void> {\n  await getDb().delete(posts).where(eq(posts.id, id))\n}\n\nexport async function findPostByAlias(alias: string): Promise<PostRecord | undefined> {\n  const rows = await getDb().select().from(posts).where(and(eq(posts.alias, alias), isNull(posts.deletedAt))).limit(1)\n  if (!rows[0]) return undefined\n  return getPost(rows[0].id)\n}")

print('post.repository ok')
