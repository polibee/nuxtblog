import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'

const isBlogDbReady = vi.fn()
const listLocales = vi.fn()
const bumpAiDomains = vi.fn()
const emitCmsEvent = vi.fn()
const findPostRow = vi.fn()
const findPublishedByAlias = vi.fn()
const findPostByAlias = vi.fn()
const getPost = vi.fn()
const insertPost = vi.fn()
const updatePostRow = vi.fn()
const listPublished = vi.fn()
const listPublishedArchive = vi.fn()
const coverUrlFor = vi.fn()
const findTaxonomyRow = vi.fn()
const postsInTaxonomy = vi.fn()
const relationsForPost = vi.fn()
const replacePostRelations = vi.fn()
const termsForLocale = vi.fn()
const findTaxonomyIdByAlias = vi.fn()
const countApprovedCommentsByPostIds = vi.fn()
const listViewCounts = vi.fn()
const findPublishedNeighbors = vi.fn()

vi.mock('../../server/repositories/db.server', () => ({ isBlogDbReady }))
vi.mock('../../server/repositories/locale.runtime.repository', () => ({ listLocales }))
vi.mock('../../server/modules/ai/optimization/invalidate', () => ({ bumpAiDomains }))
vi.mock('../../server/utils/events', () => ({ emitCmsEvent }))
vi.mock('../../server/repositories/post.runtime.repository', () => ({
  coverUrlFor,
  deletePostRow: vi.fn(),
  findPostRow,
  findPublishedByAlias,
  findPostByAlias,
  getPost,
  insertPost,
  listPosts: vi.fn(),
  listPublished,
  listPublishedArchive,
  promoteScheduledPosts: vi.fn(),
  updatePostRow
}))
vi.mock('../../server/repositories/taxonomy.repository', () => ({
  findTaxonomyRow,
  postsInTaxonomy,
  relationsForPost,
  replacePostRelations,
  termsForLocale
}))
vi.mock('../../server/modules/taxonomy/taxonomy.service', () => ({ findTaxonomyIdByAlias }))
vi.mock('../../server/repositories/comment.runtime.repository', () => ({ countApprovedCommentsByPostIds }))
vi.mock('../../server/repositories/analytics.repository', () => ({ listViewCounts }))
vi.mock('../../server/repositories/post-neighbors.repository', () => ({ findPublishedNeighbors }))
vi.mock('../../server/utils/navigationCache', () => ({ invalidateAllNavigationCaches: vi.fn() }))

const publishedRow = {
  postId: 7,
  title: 'Cover regression',
  alias: 'cover-regression',
  excerpt: '',
  content: '<p>Content</p>',
  seoTitle: '',
  seoDescription: '',
  noindex: false,
  publishedAt: new Date('2026-09-13T00:00:00.000Z'),
  coverMediaId: 12,
  accessType: 'public' as const,
  paidPriceMinor: null,
  paidCurrency: null,
  authorName: 'Admin',
  commentStatus: 'closed' as const
}

const postRecord = {
  id: 7,
  alias: 'cover-regression',
  primaryLocaleCode: 'zh-CN',
  authorId: 1,
  featuredMediaId: 12 as number | null,
  accessType: 'public' as const,
  status: 'draft' as const,
  publishedAt: null,
  scheduledAt: null,
  commentStatus: 'closed' as const,
  createdAt: new Date('2026-09-13T00:00:00.000Z'),
  updatedAt: new Date('2026-09-13T00:00:00.000Z'),
  translations: {
    1: { title: 'Cover regression', excerpt: '', content: '<p>Content</p>' }
  },
  categoryIds: [],
  tagIds: []
}

const publicRow = () => ({ ...publishedRow, coverMediaId: postRecord.featuredMediaId })

const { createPost, getPublicArchive, getPublicPostByAlias, getPublicPosts, updatePost } = await import('../../server/modules/posts/post.service')

describe('featured image public API regression', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    isBlogDbReady.mockReturnValue(true)
    listLocales.mockResolvedValue([{ id: 1, code: 'zh-CN', isDefault: true }])
    findPostByAlias.mockResolvedValue(undefined)
    findPostRow.mockResolvedValue(postRecord)
    getPost.mockImplementation(async () => postRecord)
    insertPost.mockImplementation(async (entity: { featuredMediaId: number | null }) => {
      postRecord.featuredMediaId = entity.featuredMediaId
      return postRecord.id
    })
    updatePostRow.mockImplementation(async (_id: number, patch: { featuredMediaId?: number | null }) => {
      if (patch.featuredMediaId !== undefined) postRecord.featuredMediaId = patch.featuredMediaId
    })
    findPublishedByAlias.mockImplementation(async () => publicRow())
    listPublished.mockResolvedValue({ items: [publishedRow], total: 1 })
    listPublishedArchive.mockResolvedValue([])
    coverUrlFor.mockImplementation(async (mediaId: number | null) => mediaId ? `/media/${mediaId}` : null)
    relationsForPost.mockResolvedValue({ categoryIds: [], tagIds: [] })
    termsForLocale.mockResolvedValue(new Map())
    postsInTaxonomy.mockResolvedValue([])
    findTaxonomyIdByAlias.mockResolvedValue(null)
    countApprovedCommentsByPostIds.mockResolvedValue(new Map())
    listViewCounts.mockResolvedValue(new Map())
    findPublishedNeighbors.mockResolvedValue({ prev: null, next: null })
  })

  it('preserves the entity cover through create, public detail, clear, and public detail again', async () => {
    const created = await createPost({
      alias: 'cover-regression',
      featuredMediaId: 12,
      translations: { 'zh-CN': { title: 'Cover regression', content: 'Content' } }
    }, 1)

    expect(created.featuredMediaId).toBe(12)
    await expect(getPublicPostByAlias('zh-CN', created.alias)).resolves.toMatchObject({ coverUrl: '/media/12' })

    const cleared = await updatePost(created.id, { featuredMediaId: null })
    expect(cleared.featuredMediaId).toBeNull()
    await expect(getPublicPostByAlias('zh-CN', created.alias)).resolves.toMatchObject({ coverUrl: null })
  })

  it('maps the same cover URL once for each public summary item', async () => {
    const result = await getPublicPosts('zh-CN', { perPage: 12 })

    expect(result.items[0]?.coverUrl).toBe('/media/12')
    expect(coverUrlFor).toHaveBeenCalledOnce()
    expect(coverUrlFor).toHaveBeenCalledWith(12)
  })

  it('maps archive cover URLs from the published entity rows', async () => {
    listPublished.mockResolvedValue({ items: [publishedRow], total: 1 })

    const result = await getPublicArchive('zh-CN')

    expect(result.items[0]).toMatchObject({
      alias: 'cover-regression',
      coverUrl: '/media/12'
    })
    expect(coverUrlFor).toHaveBeenCalledOnce()
    expect(coverUrlFor).toHaveBeenCalledWith(12)
  })

  it('keeps admin post handlers on the raw service contract', () => {
    const getHandler = readFileSync('server/api/admin/posts/[id].get.ts', 'utf8')
    const putHandler = readFileSync('server/api/admin/posts/[id].put.ts', 'utf8')

    expect(getHandler).toContain('return getPostItem(id)')
    expect(putHandler).toContain('const body = await readBody(event)')
    expect(putHandler).toContain('return updatePost(id, body)')
  })
})
