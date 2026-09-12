import * as mysql from './comment.repository'
import * as postgres from './comment.postgres.repository'
import { createDomainRepositoryContext } from './domain-context'

const implementation = (createDomainRepositoryContext({ driver: process.env.DB_DRIVER }).isPostgres ? postgres : mysql) as typeof mysql
export type { CommentRow } from './comment.repository'
export const insertComment = implementation.insertComment
export const listApprovedComments = implementation.listApprovedComments
export const findCommentRow = implementation.findCommentRow
export const listCommentsByStatus = implementation.listCommentsByStatus
export const updateCommentStatus = implementation.updateCommentStatus
export const deleteCommentRow = implementation.deleteCommentRow
export const parentBelongsToPost = implementation.parentBelongsToPost
export const countPendingComments = implementation.countPendingComments
export const countApprovedComments = implementation.countApprovedComments
