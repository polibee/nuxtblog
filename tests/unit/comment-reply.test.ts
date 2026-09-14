import { beforeEach, describe, expect, it, vi } from 'vitest'

const findCommentRow = vi.fn()
const findPostRow = vi.fn()
const getCommentDepth = vi.fn()
const getSettingValue = vi.fn()
const insertComment = vi.fn()
const isDomainDbReady = vi.fn()

vi.mock('../../server/repositories/comment.runtime.repository', () => ({
  deleteCommentRow: vi.fn(),
  findCommentRow,
  insertComment,
  listApprovedComments: vi.fn(),
  listCommentsByStatus: vi.fn(),
  getCommentDepth,
  parentBelongsToPost: vi.fn(),
  updateCommentStatus: vi.fn()
}))

vi.mock('../../server/repositories/domain-status', () => ({ isDomainDbReady }))
vi.mock('../../server/repositories/post.runtime.repository', () => ({ findPostRow }))
vi.mock('../../server/modules/settings/settings.runtime.service', () => ({ getSettingValue }))
vi.mock('../../server/modules/ai/optimization/invalidate', () => ({ bumpAiDomains: vi.fn() }))

const admin = { id: 1, name: 'Admin', email: 'admin@example.com' }

const target = {
  id: 10,
  postId: 7,
  parentId: null,
  userId: null,
  authorName: 'Guest',
  authorEmail: 'guest@example.com',
  authorUrl: null,
  gravatarHash: null,
  browserName: null,
  browserVersion: null,
  osName: null,
  osVersion: null,
  deviceType: 'unknown',
  ipHash: null,
  content: 'Original comment',
  status: 'approved' as const,
  moderationReason: null,
  approvedAt: new Date('2026-09-12T00:00:00.000Z'),
  approvedBy: null,
  createdAt: new Date('2026-09-12T00:00:00.000Z')
}

describe('administrator comment replies', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    isDomainDbReady.mockReturnValue(true)
    findCommentRow.mockResolvedValue(target)
    findPostRow.mockResolvedValue({ id: target.postId, alias: 'hello-world' })
    getCommentDepth.mockResolvedValue(0)
    getSettingValue.mockImplementation(async (_key: string, fallback: string | number | boolean) => fallback)
    insertComment.mockResolvedValue(101)
  })

  it('creates a reply under the target post and records the administrator', async () => {
    const { replyToComment } = await import('../../server/modules/comments/comment.service')

    const reply = await replyToComment(10, { content: 'Thanks for reporting this.' }, admin)

    expect(reply).toMatchObject({
      id: 101,
      postId: 7,
      postTitle: 'hello-world',
      parentId: 10,
      userId: 1,
      authorName: 'Admin',
      authorEmail: 'admin@example.com',
      status: 'pending',
      content: 'Thanks for reporting this.'
    })
    expect(insertComment).toHaveBeenCalledWith(expect.objectContaining({
      postId: 7,
      parentId: 10,
      userId: 1,
      authorName: 'Admin',
      status: 'pending',
      approvedAt: null,
      approvedBy: null
    }))
  })

  it('rejects a reply when the visual nesting limit is reached', async () => {
    getCommentDepth.mockResolvedValue(3)
    const { replyToComment } = await import('../../server/modules/comments/comment.service')

    await expect(replyToComment(10, { content: 'Too deep' }, admin))
      .rejects.toMatchObject({ statusCode: 422 })
    expect(insertComment).not.toHaveBeenCalled()
  })

  it('stores sanitized reply content', async () => {
    const { replyToComment } = await import('../../server/modules/comments/comment.service')

    await replyToComment(10, { content: '<p>Useful <strong>reply</strong></p><script>alert(1)</script>' }, admin)

    expect(insertComment).toHaveBeenCalledWith(expect.objectContaining({
      content: 'Useful reply'
    }))
  })

  it('approves a reply immediately and records approval metadata when approval is disabled', async () => {
    getSettingValue.mockImplementation(async (key: string, fallback: string | number | boolean) => {
      return key === 'comments.require_approval' ? false : fallback
    })
    const { replyToComment } = await import('../../server/modules/comments/comment.service')

    const reply = await replyToComment(10, { content: 'Approved reply' }, admin)

    expect(reply.status).toBe('approved')
    expect(insertComment).toHaveBeenCalledWith(expect.objectContaining({
      status: 'approved',
      approvedAt: expect.any(Date),
      approvedBy: admin.id
    }))
  })
})
