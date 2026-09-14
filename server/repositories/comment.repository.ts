import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm'
import { getDb } from './db.server'
import { comments } from './schema/comments'
import type { CommentStatus } from '#shared/schemas/comment'

export interface CommentRow {
  id: number
  postId: number
  parentId: number | null
  userId: number | null
  authorName: string
  authorEmail: string
  authorUrl: string | null
  gravatarHash: string | null
  browserName: string | null
  browserVersion: string | null
  osName: string | null
  osVersion: string | null
  deviceType: string | null
  ipHash: string | null
  content: string
  status: CommentStatus
  moderationReason: string | null
  approvedAt: Date | null
  approvedBy: number | null
  createdAt: Date
}

function toRow(row: typeof comments.$inferSelect): CommentRow {
  return { ...row, status: row.status as CommentStatus }
}

type CommentParentRow = Pick<typeof comments.$inferSelect, 'parentId'>

export async function insertComment(input: {
  postId: number
  parentId: number | null
  userId: number | null
  authorName: string
  authorEmail: string
  authorUrl: string | null
  gravatarHash: string | null
  browserName: string | null
  browserVersion: string | null
  osName: string | null
  osVersion: string | null
  deviceType: string | null
  ipHash: string | null
  content: string
  status: CommentStatus
  moderationReason?: string | null
  approvedAt?: Date | null
  approvedBy?: number | null
}): Promise<number> {
  const [row] = await getDb().insert(comments).values(input)
  if (!row) throw new Error('comment insert returned no id')
  return row.insertId
}

/** approved top-level + nested comments of one post (public tree) */
export async function listApprovedComments(postId: number): Promise<CommentRow[]> {
  const rows = await getDb()
    .select()
    .from(comments)
    .where(and(
      eq(comments.postId, postId),
      eq(comments.status, 'approved')
    ))
    .orderBy(asc(comments.createdAt))
  return rows.map(toRow)
}

export async function findCommentRow(id: number): Promise<CommentRow | undefined> {
  const rows = await getDb().select().from(comments).where(eq(comments.id, id)).limit(1)
  return rows[0] ? toRow(rows[0]) : undefined
}

export async function listCommentsByStatus(status: CommentStatus | 'all', limit: number): Promise<CommentRow[]> {
  const condition = status === 'all' ? undefined : eq(comments.status, status)
  const rows = await getDb()
    .select()
    .from(comments)
    .where(condition)
    .orderBy(desc(comments.createdAt))
    .limit(limit)
  return rows.map(toRow)
}

export async function updateCommentStatus(id: number, status: CommentStatus): Promise<void> {
  await getDb().update(comments).set({ status }).where(eq(comments.id, id))
}

export async function deleteCommentRow(id: number): Promise<void> {
  await getDb().delete(comments).where(eq(comments.id, id))
}

/** is the referenced parent a visible comment of the same post? */
export async function parentBelongsToPost(parentId: number, postId: number): Promise<boolean> {
  const rows = await getDb()
    .select({ id: comments.id })
    .from(comments)
    .where(and(eq(comments.id, parentId), eq(comments.postId, postId), eq(comments.status, 'approved')))
    .limit(1)
  return rows.length > 0
}

/** Return the zero-based depth of a comment in its parent chain. */
export async function getCommentDepth(commentId: number): Promise<number> {
  let currentId: number | null = commentId
  let depth = 0
  const visited = new Set<number>()
  while (currentId !== null && !visited.has(currentId)) {
    visited.add(currentId)
    const rows: CommentParentRow[] = await getDb()
      .select({ parentId: comments.parentId })
      .from(comments)
      .where(eq(comments.id, currentId))
      .limit(1)
    const row: CommentParentRow | undefined = rows[0]
    if (!row || row.parentId === null) return depth
    depth += 1
    currentId = row.parentId
  }
  return depth
}

export async function countPendingComments(): Promise<number> {
  const [row] = await getDb()
    .select({ total: sql<number>`count(*)` })
    .from(comments)
    .where(eq(comments.status, 'pending'))
  return Number(row?.total ?? 0)
}

export async function countApprovedComments(): Promise<number> {
  const [row] = await getDb()
    .select({ total: sql<number>`count(*)` })
    .from(comments)
    .where(eq(comments.status, 'approved'))
  return Number(row?.total ?? 0)
}

export async function countApprovedCommentsByPostIds(postIds: number[]): Promise<Map<number, number>> {
  const result = new Map<number, number>()
  if (postIds.length === 0) return result
  const rows = await getDb()
    .select({ postId: comments.postId, total: sql<number>`count(*)` })
    .from(comments)
    .where(and(eq(comments.status, 'approved'), inArray(comments.postId, postIds)))
    .groupBy(comments.postId)
  for (const row of rows) result.set(row.postId, Number(row.total))
  return result
}
