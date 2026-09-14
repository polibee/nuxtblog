import { createError } from 'h3'
import { createHash } from 'node:crypto'
import {
  commentInputSchema,
  commentReplySchema,
  COMMENT_STATUSES,
  type AdminComment,
  type CommentStatus,
  type PublicComment
} from '#shared/schemas/comment'
import { isSafeCommentWebsite } from '#shared/schemas/comment'
import { isDomainDbReady } from '../../repositories/domain-status'
import {
  deleteCommentRow,
  findCommentRow,
  insertComment,
  listApprovedComments,
  listCommentsByStatus,
  getCommentDepth,
  parentBelongsToPost,
  updateCommentStatus,
  type CommentRow
} from '../../repositories/comment.runtime.repository'
import { findPostRow } from '../../repositories/post.runtime.repository'
import { sanitizeRichText } from '../../utils/sanitize'
import { gravatarHash, parseCommentMetadata } from '../../utils/comment-metadata'
import { verifyTurnstile } from '../../utils/turnstile'
import { getSettingValue } from '../settings/settings.runtime.service'
import { bumpAiDomains } from '../ai/optimization/invalidate'
import { listPublicBadges } from '../badges/badge.service'

/* Comment domain service (P07): guests/users submit; everything lands
   in 'pending' (moderation gate); only 'approved' renders publicly.
   Content is stored as plain text (all markup stripped). */

export type { AdminComment, CommentRow }

function stripMarkup(html: string): string {
  return sanitizeRichText(html).replace(/<[^>]*>/g, '').trim()
}

function settingEnabled(value: string | number | boolean, fallback: boolean): boolean {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value === 1
  if (!value) return fallback
  return value === 'true' || value === '1'
}

function settingNumber(value: string | number | boolean, fallback: number): number {
  const number = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(number) ? Math.max(Math.floor(number), 0) : fallback
}

function hashCommentIp(ip: string): string | null {
  const salt = process.env.COMMENTS_IP_HASH_SALT ?? process.env.IP_HASH_SALT ?? ''
  if (!salt || !ip || ip === 'unknown') return null
  return createHash('sha256').update(`${salt}:${ip}`).digest('hex')
}

async function commentVisibility(): Promise<{
  showBrowser: boolean
  showOs: boolean
  showGravatar: boolean
  showGuestWebsite: boolean
}> {
  const [showBrowser, showOs, showGravatar, showGuestWebsite] = await Promise.all([
    getSettingValue('comments.show_browser', true),
    getSettingValue('comments.show_os', true),
    getSettingValue('comments.show_gravatar', true),
    getSettingValue('comments.show_guest_website', true)
  ])
  return {
    showBrowser: settingEnabled(showBrowser, true),
    showOs: settingEnabled(showOs, true),
    showGravatar: settingEnabled(showGravatar, true),
    showGuestWebsite: settingEnabled(showGuestWebsite, true)
  }
}

function toAdminComment(row: CommentRow, postTitle: string): AdminComment {
  return {
    id: row.id,
    postId: row.postId,
    postTitle,
    parentId: row.parentId,
    userId: row.userId,
    authorName: row.authorName,
    authorEmail: row.authorEmail,
    content: row.content,
    status: row.status,
    createdAt: row.createdAt.toISOString()
  }
}

export async function replyToComment(
  commentId: number,
  input: unknown,
  adminUser: { id: number, name: string, email: string }
): Promise<AdminComment> {
  if (!isDomainDbReady()) {
    throw createError({ statusCode: 503, statusMessage: 'Database unavailable' })
  }

  const result = commentReplySchema.safeParse(input)
  if (!result.success) {
    throw createError({
      statusCode: 422,
      statusMessage: result.error.issues[0]?.message ?? 'Invalid reply'
    })
  }

  const target = await findCommentRow(commentId)
  if (!target || target.status === 'spam') {
    throw createError({ statusCode: 404, statusMessage: `Comment #${commentId} not found` })
  }
  const post = await findPostRow(target.postId)
  if (!post) {
    throw createError({ statusCode: 422, statusMessage: 'Invalid comment target' })
  }

  const maxReplyDepth = Math.min(settingNumber(await getSettingValue('comments.max_reply_depth', 3), 3), 3)
  if (await getCommentDepth(target.id) >= maxReplyDepth) {
    throw createError({ statusCode: 422, statusMessage: 'Maximum reply depth exceeded' })
  }

  const content = stripMarkup(result.data.content)
  if (!content) {
    throw createError({ statusCode: 422, statusMessage: 'Reply content is required' })
  }

  const requireApproval = settingEnabled(await getSettingValue('comments.require_approval', true), true)
  const status: CommentStatus = requireApproval ? 'pending' : 'approved'
  const approvedAt = status === 'approved' ? new Date() : null
  const approvedBy = status === 'approved' ? adminUser.id : null
  const createdAt = new Date()
  const id = await insertComment({
    postId: target.postId,
    parentId: target.id,
    userId: adminUser.id,
    authorName: adminUser.name,
    authorEmail: adminUser.email,
    authorUrl: null,
    gravatarHash: gravatarHash(adminUser.email),
    browserName: null,
    browserVersion: null,
    osName: null,
    osVersion: null,
    deviceType: null,
    ipHash: null,
    content,
    status,
    moderationReason: null,
    approvedAt,
    approvedBy
  })
  await bumpAiDomains(['comments'])

  return toAdminComment({
    id,
    postId: target.postId,
    parentId: target.id,
    userId: adminUser.id,
    authorName: adminUser.name,
    authorEmail: adminUser.email,
    authorUrl: null,
    gravatarHash: gravatarHash(adminUser.email),
    browserName: null,
    browserVersion: null,
    osName: null,
    osVersion: null,
    deviceType: null,
    ipHash: null,
    content,
    status,
    moderationReason: null,
    approvedAt,
    approvedBy,
    createdAt
  }, post.alias)
}

export async function submitComment(
  postId: number,
  postCommentStatus: string,
  input: unknown,
  user: { id: number, name: string, email: string } | null,
  request: { ip?: string, userAgent?: string } = {}
): Promise<{ id: number, status: CommentStatus }> {
  if (!isDomainDbReady()) {
    throw createError({ statusCode: 503, statusMessage: 'Database unavailable' })
  }
  const result = commentInputSchema.safeParse(input)
  if (!result.success) {
    throw createError({
      statusCode: 422,
      statusMessage: result.error.issues[0]?.message ?? 'Invalid comment'
    })
  }
  const data = result.data

  if (!user && (!data.name || !data.email)) {
    throw createError({ statusCode: 422, statusMessage: 'Guest name and email are required' })
  }

  if (postCommentStatus !== 'open') {
    throw createError({ statusCode: 403, statusMessage: 'Comments are closed for this post' })
  }
  if (!user && !settingEnabled(await getSettingValue('comments.guest_enabled', true), true)) {
    throw createError({ statusCode: 403, statusMessage: 'Guest comments are disabled' })
  }
  if (data.parentId && !(await parentBelongsToPost(data.parentId, postId))) {
    throw createError({ statusCode: 422, statusMessage: 'Invalid parent comment' })
  }
  if (data.parentId) {
    const maxReplyDepth = Math.min(settingNumber(await getSettingValue('comments.max_reply_depth', 3), 3), 3)
    if (await getCommentDepth(data.parentId) >= maxReplyDepth) {
      throw createError({ statusCode: 422, statusMessage: 'Maximum reply depth exceeded' })
    }
  }

  if (!user && settingEnabled(await getSettingValue('comments.turnstile_enabled', false), false)) {
    const verified = await verifyTurnstile(data.turnstileToken ?? '', request.ip ?? 'unknown')
    if (!verified) {
      throw createError({ statusCode: 422, statusMessage: 'Turnstile verification failed' })
    }
  }

  const website = !user && data.website && isSafeCommentWebsite(data.website) ? data.website : null
  if (!user && data.website && !website) {
    throw createError({ statusCode: 422, statusMessage: 'Invalid guest website' })
  }
  const email = user?.email ?? data.email!
  const metadata = parseCommentMetadata(request.userAgent ?? '')
  const requireApproval = settingEnabled(await getSettingValue('comments.require_approval', true), true)
  const status: CommentStatus = requireApproval ? 'pending' : 'approved'
  const approvedAt = status === 'approved' ? new Date() : null

  const id = await insertComment({
    postId,
    parentId: data.parentId ?? null,
    userId: user?.id ?? null,
    authorName: user?.name ?? data.name!,
    authorEmail: email,
    authorUrl: website,
    gravatarHash: gravatarHash(email),
    browserName: metadata.browserName,
    browserVersion: metadata.browserVersion,
    osName: metadata.osName,
    osVersion: metadata.osVersion,
    deviceType: metadata.deviceType,
    ipHash: hashCommentIp(request.ip ?? 'unknown'),
    content: stripMarkup(data.content),
    status,
    moderationReason: null,
    approvedAt,
    approvedBy: null
  })
  await bumpAiDomains(['comments'])
  return { id, status }
}

export async function getPublicCommentTreeByAlias(localeCode: string, alias: string): Promise<PublicComment[]> {
  const { getPublicPostByAlias } = await import('../posts/post.service')
  const post = await getPublicPostByAlias(localeCode, alias)
  if (!post) return []
  return getPublicCommentTree(post.id)
}

export async function getPublicCommentTree(postId: number): Promise<PublicComment[]> {
  const rows = await listApprovedComments(postId)
  const visibility = await commentVisibility()
  const byParent = new Map<number | null, PublicComment[]>()
  for (const row of rows) {
    const comment: PublicComment = {
      id: row.id,
      parentId: row.parentId,
      authorName: row.authorName,
      avatarUrl: visibility.showGravatar && row.gravatarHash
        ? `https://www.gravatar.com/avatar/${row.gravatarHash}?d=identicon&s=80`
        : null,
      websiteUrl: visibility.showGuestWebsite && row.userId === null && row.authorUrl && isSafeCommentWebsite(row.authorUrl)
        ? row.authorUrl
        : null,
      browserName: visibility.showBrowser ? row.browserName : null,
      browserVersion: visibility.showBrowser ? row.browserVersion : null,
      osName: visibility.showOs ? row.osName : null,
      osVersion: visibility.showOs ? row.osVersion : null,
      deviceType: (row.deviceType === 'desktop' || row.deviceType === 'mobile' || row.deviceType === 'tablet')
        ? row.deviceType
        : 'unknown',
      badges: row.userId ? await listPublicBadges(row.userId) : [],
      content: row.content,
      createdAt: row.createdAt.toISOString(),
      children: []
    }
    const bucket = byParent.get(row.parentId) ?? []
    bucket.push(comment)
    byParent.set(row.parentId, bucket)
  }
  function build(parent: number | null): PublicComment[] {
    const children = byParent.get(parent) ?? []
    for (const child of children) child.children = build(child.id)
    return children
  }
  return build(null)
}

export async function listCommentsForAdmin(query: { status?: string, limit?: number }): Promise<AdminComment[]> {
  const status = (query.status && (COMMENT_STATUSES as readonly string[]).includes(query.status)
    ? query.status as CommentStatus
    : 'all')
  const rows = await listCommentsByStatus(status, Math.min(query.limit ?? 100, 200))
  const postIds = [...new Set(rows.map(r => r.postId))]
  const titles = new Map<number, string>()
  for (const postId of postIds) {
    const row = await findPostRow(postId)
    if (row) titles.set(row.id, row.alias)
  }
  return rows.map(row => toAdminComment(row, titles.get(row.postId) ?? `#${row.postId}`))
}

export async function moderateComment(id: number, status: CommentStatus): Promise<AdminComment> {
  const row = await findCommentRow(id)
  if (!row) {
    throw createError({ statusCode: 404, statusMessage: `Comment #${id} not found` })
  }
  await updateCommentStatus(id, status)
  await bumpAiDomains(['comments'])
  const post = await findPostRow(row.postId)
  return toAdminComment({ ...row, status }, post?.alias ?? `#${row.postId}`)
}

export async function deleteComment(id: number): Promise<void> {
  if (!(await findCommentRow(id))) {
    throw createError({ statusCode: 404, statusMessage: `Comment #${id} not found` })
  }
  await deleteCommentRow(id)
  await bumpAiDomains(['comments'])
}
