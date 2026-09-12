import { createError } from 'h3'
import {
  commentInputSchema,
  COMMENT_STATUSES,
  type AdminComment,
  type CommentStatus,
  type PublicComment
} from '#shared/schemas/comment'
import { isDomainDbReady } from '../../repositories/domain-status'
import {
  deleteCommentRow,
  findCommentRow,
  insertComment,
  listApprovedComments,
  listCommentsByStatus,
  parentBelongsToPost,
  updateCommentStatus,
  type CommentRow
} from '../../repositories/comment.runtime.repository'
import { findPostRow } from '../../repositories/post.runtime.repository'
import { sanitizeRichText } from '../../utils/sanitize'
import { bumpAiDomains } from '../ai/optimization/invalidate'

/* Comment domain service (P07): guests/users submit; everything lands
   in 'pending' (moderation gate); only 'approved' renders publicly.
   Content is stored as plain text (all markup stripped). */

export type { AdminComment, CommentRow }

function stripMarkup(html: string): string {
  return sanitizeRichText(html).replace(/<[^>]*>/g, '').trim()
}

function toAdminComment(row: CommentRow, postTitle: string): AdminComment {
  return {
    id: row.id,
    postId: row.postId,
    postTitle,
    parentId: row.parentId,
    authorName: row.authorName,
    authorEmail: row.authorEmail,
    content: row.content,
    status: row.status,
    createdAt: row.createdAt.toISOString()
  }
}

export async function submitComment(postId: number, postCommentStatus: string, input: unknown, user: { id: number, name: string, email: string } | null): Promise<{ id: number, status: CommentStatus }> {
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

  if (postCommentStatus !== 'open') {
    throw createError({ statusCode: 403, statusMessage: 'Comments are closed for this post' })
  }
  if (data.parentId && !(await parentBelongsToPost(data.parentId, postId))) {
    throw createError({ statusCode: 422, statusMessage: 'Invalid parent comment' })
  }

  const id = await insertComment({
    postId,
    parentId: data.parentId ?? null,
    userId: user?.id ?? null,
    authorName: user?.name ?? data.name,
    authorEmail: user?.email ?? data.email,
    content: stripMarkup(data.content)
  })
  // everything starts in moderation
  await bumpAiDomains(['comments'])
  return { id, status: 'pending' }
}

export async function getPublicCommentTreeByAlias(localeCode: string, alias: string): Promise<PublicComment[]> {
  const { getPublicPostByAlias } = await import('../posts/post.service')
  const post = await getPublicPostByAlias(localeCode, alias)
  if (!post) return []
  return getPublicCommentTree(post.id)
}

export async function getPublicCommentTree(postId: number): Promise<PublicComment[]> {
  const rows = await listApprovedComments(postId)
  const byParent = new Map<number | null, PublicComment[]>()
  for (const row of rows) {
    const comment: PublicComment = {
      id: row.id,
      parentId: row.parentId,
      authorName: row.authorName,
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
