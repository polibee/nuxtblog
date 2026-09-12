import { and, asc, desc, eq, sql } from 'drizzle-orm'
import { getPostgresDb } from './db-postgres.server'
import { comments } from './schema-postgres/comments'
import type { CommentStatus } from '#shared/schemas/comment'

export interface CommentRow { id: number, postId: number, parentId: number | null, userId: number | null, authorName: string, authorEmail: string, content: string, status: CommentStatus, createdAt: Date }
const toRow = (row: typeof comments.$inferSelect): CommentRow => ({ ...row, status: row.status as CommentStatus })
export async function insertComment(input: { postId: number, parentId: number | null, userId: number | null, authorName: string, authorEmail: string, content: string }) {
  const [row] = await getPostgresDb().insert(comments).values(input).returning({ id: comments.id })
  if (!row) throw new Error('comment insert returned no id')
  return row.id
}
export async function listApprovedComments(postId: number) {
  const rows = await getPostgresDb().select().from(comments).where(and(eq(comments.postId, postId), eq(comments.status, 'approved'))).orderBy(asc(comments.createdAt))
  return rows.map(toRow)
}
export async function findCommentRow(id: number) {
  const rows = await getPostgresDb().select().from(comments).where(eq(comments.id, id)).limit(1)
  return rows[0] ? toRow(rows[0]) : undefined
}
export async function listCommentsByStatus(status: CommentStatus | 'all', limit: number) {
  const rows = await getPostgresDb().select().from(comments).where(status === 'all' ? undefined : eq(comments.status, status)).orderBy(desc(comments.createdAt)).limit(limit)
  return rows.map(toRow)
}
export async function updateCommentStatus(id: number, status: CommentStatus) {
  await getPostgresDb().update(comments).set({ status }).where(eq(comments.id, id))
}
export async function deleteCommentRow(id: number) {
  await getPostgresDb().delete(comments).where(eq(comments.id, id))
}
export async function parentBelongsToPost(parentId: number, postId: number) {
  const rows = await getPostgresDb().select({ id: comments.id }).from(comments).where(and(eq(comments.id, parentId), eq(comments.postId, postId), eq(comments.status, 'approved'))).limit(1)
  return rows.length > 0
}
export async function countPendingComments() {
  const [row] = await getPostgresDb().select({ total: sql<number>`count(*)` }).from(comments).where(eq(comments.status, 'pending'))
  return Number(row?.total ?? 0)
}
export async function countApprovedComments() {
  const [row] = await getPostgresDb().select({ total: sql<number>`count(*)` }).from(comments).where(eq(comments.status, 'approved'))
  return Number(row?.total ?? 0)
}
