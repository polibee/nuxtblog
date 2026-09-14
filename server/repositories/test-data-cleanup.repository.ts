import { count, eq, inArray, like, or } from 'drizzle-orm'
import { getDb } from './db.server'
import { adCampaigns, adCreativeTranslations, adCreatives, adPlacements } from './schema/advertising'
import { comments } from './schema/comments'
import { media, mediaTranslations, mediaVariants } from './schema/media'
import { posts } from './schema/posts'

const testPostWhere = or(like(posts.alias, 'demo-%'), like(posts.alias, 'pagination-test-%'))
const testCampaignWhere = or(like(adCampaigns.name, 'Demo · %'), like(adCampaigns.name, 'E2E %'))
const testCommentWhere = or(like(comments.content, 'E2E %'), eq(comments.authorEmail, 'e2e@example.com'))
const testMediaWhere = like(media.filename, 'demo-banner-%')

export interface TestDataCounts {
  posts: number
  comments: number
  campaigns: number
  creatives: number
  media: number
}

export async function getTestDataCounts(): Promise<TestDataCounts> {
  const db = getDb()
  const [postRows, commentRows, campaignRows, creativeRows, mediaRows] = await Promise.all([
    db.select({ total: count() }).from(posts).where(testPostWhere),
    db.select({ total: count() }).from(comments).where(testCommentWhere),
    db.select({ total: count() }).from(adCampaigns).where(testCampaignWhere),
    db.select({ total: count() }).from(adCreatives),
    db.select({ total: count() }).from(media).where(testMediaWhere)
  ])
  return {
    posts: Number(postRows[0]?.total ?? 0),
    comments: Number(commentRows[0]?.total ?? 0),
    campaigns: Number(campaignRows[0]?.total ?? 0),
    creatives: Number(creativeRows[0]?.total ?? 0),
    media: Number(mediaRows[0]?.total ?? 0)
  }
}

export async function cleanupTestData(): Promise<TestDataCounts> {
  const db = getDb()
  return db.transaction(async (tx) => {
    const campaignRows = await tx.select({ id: adCampaigns.id }).from(adCampaigns).where(testCampaignWhere)
    const campaignIds = campaignRows.map(row => row.id)
    let creativeCount = 0
    if (campaignIds.length > 0) {
      const creativeRows = await tx.select({ id: adCreatives.id }).from(adCreatives).where(inArray(adCreatives.campaignId, campaignIds))
      const creativeIds = creativeRows.map(row => row.id)
      creativeCount = creativeIds.length
      await tx.delete(adPlacements).where(inArray(adPlacements.campaignId, campaignIds))
      if (creativeIds.length > 0) {
        await tx.delete(adCreativeTranslations).where(inArray(adCreativeTranslations.creativeId, creativeIds))
        await tx.delete(adCreatives).where(inArray(adCreatives.id, creativeIds))
      }
      // Keep financial history, but detach it before removing the demo campaign.
      await tx.update(adCampaigns).set({ orderId: null }).where(inArray(adCampaigns.id, campaignIds))
      await tx.delete(adCampaigns).where(inArray(adCampaigns.id, campaignIds))
    }

    const postRows = await tx.select({ id: posts.id }).from(posts).where(testPostWhere)
    const postIds = postRows.map(row => row.id)
    if (postIds.length > 0) await tx.delete(posts).where(inArray(posts.id, postIds))

    const commentRows = await tx.select({ id: comments.id }).from(comments).where(testCommentWhere)
    const commentIds = commentRows.map(row => row.id)
    if (commentIds.length > 0) await tx.delete(comments).where(inArray(comments.id, commentIds))

    const mediaRows = await tx.select({ id: media.id }).from(media).where(testMediaWhere)
    const mediaIds = mediaRows.map(row => row.id)
    if (mediaIds.length > 0) {
      await tx.delete(mediaVariants).where(inArray(mediaVariants.mediaId, mediaIds))
      await tx.delete(mediaTranslations).where(inArray(mediaTranslations.mediaId, mediaIds))
      await tx.delete(media).where(inArray(media.id, mediaIds))
    }

    return {
      posts: postIds.length,
      comments: commentIds.length,
      campaigns: campaignIds.length,
      creatives: creativeCount,
      media: mediaIds.length
    }
  })
}
