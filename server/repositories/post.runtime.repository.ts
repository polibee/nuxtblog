import * as mysql from './post.repository'
import * as postgres from './post.postgres.repository'

const usePostgres = process.env.DB_DRIVER === 'postgres' || process.env.DB_DRIVER === 'supabase'
const implementation = (usePostgres ? postgres : mysql) as typeof mysql

export type { PostRecord, PostTranslationRow, PostListQuery, PublishedTranslation, PublishedArchiveItem, RecentPost } from './post.repository'
export const listPosts = implementation.listPosts
export const findPostRow = implementation.findPostRow
export const getPost = implementation.getPost
export const insertPost = implementation.insertPost
export const updatePostRow = implementation.updatePostRow
export const deletePostRow = implementation.deletePostRow
export const listPublished = implementation.listPublished
export const listPublishedArchive = implementation.listPublishedArchive
export const findPublishedByAlias = implementation.findPublishedByAlias
export const promoteScheduledPosts = implementation.promoteScheduledPosts
export const coverUrlFor = implementation.coverUrlFor
export const findPublishedPostAliasById = implementation.findPublishedPostAliasById
export const findPostByAlias = implementation.findPostByAlias
export const countPostsByStatus = implementation.countPostsByStatus
export const listRecentPosts = implementation.listRecentPosts
