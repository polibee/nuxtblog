import { requireUser } from '../../utils/auth'
import { countUsers, countUsersByStatus } from '../../repositories/user.runtime.repository'
import {
  countPostsByStatus,
  listRecentPosts,
  type RecentPost
} from '../../repositories/post.runtime.repository'
import { countApprovedComments, countPendingComments } from '../../repositories/comment.repository'
import { countPagesByStatus } from '../../repositories/page.runtime.repository'
import { isBlogDbReady } from '../../repositories/db.server'

/** Aggregated data for dashboard widgets — all counts from real MySQL tables. */
export default defineEventHandler(async (event) => {
  await requireUser(event)

  const usersTotal = await countUsers().catch(() => 0)
  const usersActive = await countUsersByStatus('active').catch(() => 0)

  const postsPublished = await countPostsByStatus('published').catch(() => 0)
  const postsDraft = await countPostsByStatus('draft').catch(() => 0)
  const recentPosts: RecentPost[] = await listRecentPosts(5).catch(() => [])

  const pendingComments = await countPendingComments().catch(() => 0)
  const approvedComments = await countApprovedComments().catch(() => 0)
  const pagesPublished = await countPagesByStatus('published').catch(() => 0)

  return {
    usersTotal,
    usersActive,
    postsPublished,
    postsDraft,
    recentPosts,
    pendingComments,
    approvedComments,
    pagesPublished,
    dbReady: isBlogDbReady()
  }
})
