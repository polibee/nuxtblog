import { withArtifact } from './artifact-cache'
import { getVersionMap, versionSignature, type AiDomain } from './domain-versions'
import { sha256 } from './fingerprint'
import { singleFlight } from './single-flight'

/* P31 Site Snapshot (缓存优化 §11): the assistant's first look at the
   site must NOT run a dozen COUNT queries per turn. The snapshot is
   cached as an artifact keyed on the version map and refreshed only
   when a content domain bumps. */

export interface AiSiteSnapshot {
  posts: { published: number, draft: number, missingSeo: number }
  pages: number
  products: number
  comments: { approved: number, pending: number }
  profile: { exists: boolean, sections: number }
  media: number
  locales: number
  versions: Record<string, number>
}

const ALL_DOMAINS: AiDomain[] = ['posts', 'pages', 'profile', 'taxonomy', 'comments', 'products', 'media']

export async function getSiteSnapshot(): Promise<AiSiteSnapshot> {
  const versions = await getVersionMap()
  const fingerprint = sha256(`site-snapshot:${versionSignature(versions, ALL_DOMAINS)}`)
  const { payload } = await withArtifact<AiSiteSnapshot>(
    { entityType: 'site', entityId: 'snapshot', artifactType: 'snapshot', fingerprint },
    () => singleFlight('site-snapshot', computeSnapshot)
  )
  return payload
}

async function computeSnapshot(): Promise<{ payload: AiSiteSnapshot, expiresAt: Date }> {
  const { getDb, isBlogDbReady } = await import('../../../repositories/db.server')
  const { posts, postTranslations } = await import('../../../repositories/schema/posts')
  const { pages } = await import('../../../repositories/schema/pages')
  const { products } = await import('../../../repositories/schema/products')
  const { comments } = await import('../../../repositories/schema/comments')
  const { media } = await import('../../../repositories/schema/media')
  const { locales } = await import('../../../repositories/schema/locales')
  const { authorProfile, authorPageSections } = await import('../../../repositories/schema/profile')
  const { eq } = await import('drizzle-orm')

  if (!isBlogDbReady()) {
    return {
      payload: {
        posts: { published: 0, draft: 0, missingSeo: 0 },
        pages: 0,
        products: 0,
        comments: { approved: 0, pending: 0 },
        profile: { exists: false, sections: 0 },
        media: 0,
        locales: 0,
        versions: {}
      },
      expiresAt: new Date(Date.now() + 30_000)
    }
  }

  const db = getDb()
  const [postRows, pageRows, productRows, commentRows, mediaRows, localeRows, profileRows, sectionRows] = await Promise.all([
    db.select({ status: posts.status, hasSeo: postTranslations.seoDescription }).from(posts)
      .leftJoin(postTranslations, eq(postTranslations.postId, posts.id)),
    db.select({ id: pages.id }).from(pages),
    db.select({ id: products.id }).from(products),
    db.select({ status: comments.status }).from(comments),
    db.select({ id: media.id }).from(media),
    db.select({ id: locales.id }).from(locales),
    db.select({ id: authorProfile.id }).from(authorProfile).limit(1),
    db.select({ id: authorPageSections.id }).from(authorPageSections).where(eq(authorPageSections.enabled, true))
  ])

  const published = postRows.filter(p => p.status === 'published').length
  const payload: AiSiteSnapshot = {
    posts: {
      published,
      draft: postRows.filter(p => p.status !== 'published').length,
      missingSeo: postRows.filter(p => p.status === 'published' && !p.hasSeo).length
    },
    pages: pageRows.length,
    products: productRows.length,
    comments: {
      approved: commentRows.filter(c => c.status === 'approved').length,
      pending: commentRows.filter(c => c.status === 'pending').length
    },
    profile: { exists: profileRows.length > 0, sections: sectionRows.length },
    media: mediaRows.length,
    locales: localeRows.length,
    versions: {}
  }
  return { payload, expiresAt: new Date(Date.now() + 5 * 60_000) }
}

/* referenced for future incremental re-analysis (§29/30) */
export const SNAPSHOT_DOMAINS = ALL_DOMAINS
