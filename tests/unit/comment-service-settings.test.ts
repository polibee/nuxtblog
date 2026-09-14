import { beforeEach, describe, expect, it, vi } from 'vitest'

const insertComment = vi.fn()
const listApprovedComments = vi.fn()
const getCommentDepth = vi.fn()
const getSettingValue = vi.fn()
const isDomainDbReady = vi.fn()
const parentBelongsToPost = vi.fn()

vi.mock('../../server/repositories/comment.runtime.repository', () => ({
  deleteCommentRow: vi.fn(),
  findCommentRow: vi.fn(),
  insertComment,
  listApprovedComments,
  listCommentsByStatus: vi.fn(),
  getCommentDepth,
  parentBelongsToPost,
  updateCommentStatus: vi.fn()
}))

vi.mock('../../server/repositories/domain-status', () => ({ isDomainDbReady }))
vi.mock('../../server/repositories/post.runtime.repository', () => ({ findPostRow: vi.fn() }))
vi.mock('../../server/utils/sanitize', () => ({ sanitizeRichText: (value: string) => value }))
vi.mock('../../server/utils/turnstile', () => ({ verifyTurnstile: vi.fn() }))
vi.mock('../../server/modules/settings/settings.runtime.service', () => ({ getSettingValue }))
vi.mock('../../server/modules/ai/optimization/invalidate', () => ({ bumpAiDomains: vi.fn() }))

describe('comment submission settings', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    isDomainDbReady.mockReturnValue(true)
    insertComment.mockResolvedValue(42)
    listApprovedComments.mockResolvedValue([])
    getCommentDepth.mockResolvedValue(0)
    parentBelongsToPost.mockResolvedValue(true)
    getSettingValue.mockImplementation(async (_key: string, fallback: string | number | boolean) => fallback)
  })

  it('rejects guests when guest comments are disabled', async () => {
    getSettingValue.mockImplementation(async (key: string, fallback: string | number | boolean) => {
      return key === 'comments.guest_enabled' ? false : fallback
    })
    const { submitComment } = await import('../../server/modules/comments/comment.service')

    await expect(submitComment(1, 'open', {
      name: 'Guest', email: 'guest@example.com', content: 'A comment'
    }, null)).rejects.toMatchObject({ statusCode: 403 })
    expect(insertComment).not.toHaveBeenCalled()
  })

  it('rejects replies deeper than the configured maximum', async () => {
    getCommentDepth.mockResolvedValue(3)
    getSettingValue.mockImplementation(async (key: string, fallback: string | number | boolean) => {
      return key === 'comments.max_reply_depth' ? 3 : fallback
    })
    const { submitComment } = await import('../../server/modules/comments/comment.service')

    await expect(submitComment(1, 'open', {
      name: 'Guest', email: 'guest@example.com', content: 'A reply', parentId: 9
    }, null)).rejects.toMatchObject({ statusCode: 422 })
    expect(insertComment).not.toHaveBeenCalled()
  })

  it('enforces the hard reply depth cap when the setting is higher', async () => {
    getCommentDepth.mockResolvedValue(3)
    getSettingValue.mockImplementation(async (key: string, fallback: string | number | boolean) => {
      return key === 'comments.max_reply_depth' ? 10 : fallback
    })
    const { submitComment } = await import('../../server/modules/comments/comment.service')

    await expect(submitComment(1, 'open', {
      name: 'Guest', email: 'guest@example.com', content: 'Too deep', parentId: 9
    }, null)).rejects.toMatchObject({ statusCode: 422 })
    expect(insertComment).not.toHaveBeenCalled()
  })

  it('approves new comments immediately when approval is not required', async () => {
    getSettingValue.mockImplementation(async (key: string, fallback: string | number | boolean) => {
      return key === 'comments.require_approval' ? false : fallback
    })
    const { submitComment } = await import('../../server/modules/comments/comment.service')

    await expect(submitComment(1, 'open', {
      name: 'Guest', email: 'guest@example.com', content: 'A comment'
    }, null)).resolves.toEqual({ id: 42, status: 'approved' })
    expect(insertComment).toHaveBeenCalledWith(expect.objectContaining({
      status: 'approved',
      approvedAt: expect.any(Date),
      approvedBy: null
    }))
  })

  it('removes an unsafe guest author URL from the public projection', async () => {
    listApprovedComments.mockResolvedValue([{
      id: 7,
      postId: 1,
      parentId: null,
      userId: null,
      authorName: 'Guest',
      authorEmail: 'guest@example.com',
      authorUrl: 'javascript:alert(1)',
      gravatarHash: null,
      browserName: null,
      browserVersion: null,
      osName: null,
      osVersion: null,
      deviceType: 'desktop',
      ipHash: null,
      content: 'A comment',
      status: 'approved',
      moderationReason: null,
      approvedAt: new Date('2026-09-12T00:00:00.000Z'),
      approvedBy: null,
      createdAt: new Date('2026-09-12T00:00:00.000Z')
    }])
    const { getPublicCommentTree } = await import('../../server/modules/comments/comment.service')

    const [comment] = await getPublicCommentTree(1)

    expect(comment?.websiteUrl).toBeNull()
  })
})
