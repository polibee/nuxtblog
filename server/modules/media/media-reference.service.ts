import { eq, sql } from 'drizzle-orm'
import { getDb } from '../../repositories/db.server'
import { media } from '../../repositories/schema/media'
import { posts, postTranslations } from '../../repositories/schema/posts'
import { pages, pageTranslations } from '../../repositories/schema/pages'
import { sliderItems, sliders } from '../../repositories/schema/slider'
import { adCreativeTranslations } from '../../repositories/schema/advertising'
import { sidebarCards } from '../../repositories/schema/sidebar-cards'

/* MediaReferenceRegistry (media.txt §92): each consuming module answers
   "where is this media used?" — no unified reference table, queries stay
   authoritative at the source. Used by the delete guard (§35-36). */

export interface MediaReference {
  module: string
  label: string
}

export async function findMediaReferences(mediaId: number): Promise<MediaReference[]> {
  const db = getDb()
  const references: MediaReference[] = []

  const [postsHits, slidersHits, adsHits, cardsHits] = await Promise.all([
    db
      .select({ title: postTranslations.title, alias: posts.alias })
      .from(postTranslations)
      .innerJoin(posts, eq(postTranslations.postId, posts.id))
      .where(eq(postTranslations.featuredImageId, mediaId)),
    db
      .select({ name: sliders.name, key: sliders.key })
      .from(sliderItems)
      .innerJoin(sliders, eq(sliderItems.sliderId, sliders.id))
      .where(eq(sliderItems.imageMediaId, mediaId)),
    db
      .select({ title: adCreativeTranslations.title, creativeId: adCreativeTranslations.creativeId })
      .from(adCreativeTranslations)
      .where(eq(adCreativeTranslations.imageId, mediaId)),
    db.select({ type: sidebarCards.type }).from(sidebarCards).where(eq(sidebarCards.imageMediaId, mediaId))
  ])

  for (const row of postsHits) {
    references.push({ module: 'post', label: row.title || row.alias })
  }
  for (const row of slidersHits) {
    references.push({ module: 'slider', label: `${row.name} (${row.key})` })
  }
  for (const row of adsHits) {
    references.push({ module: 'advertising', label: row.title || `Creative #${row.creativeId}` })
  }
  for (const row of cardsHits) {
    references.push({ module: 'sidebar', label: `card:${row.type}` })
  }

  /* content embedding: rich text referencing /media/{storageKey} */
  const [row] = await db.select({ storageKey: media.storageKey }).from(media).where(eq(media.id, mediaId)).limit(1)
  if (row) {
    const needle = `%/media/${row.storageKey}%`
    const [postHits, pageHits] = await Promise.all([
      db
        .select({ title: postTranslations.title })
        .from(postTranslations)
        .innerJoin(posts, eq(postTranslations.postId, posts.id))
        .where(sql`${postTranslations.content} LIKE ${needle}`)
        .limit(20),
      db
        .select({ title: pageTranslations.title })
        .from(pageTranslations)
        .innerJoin(pages, eq(pageTranslations.pageId, pages.id))
        .where(sql`${pageTranslations.content} LIKE ${needle}`)
        .limit(20)
    ])
    for (const hit of postHits) references.push({ module: 'post', label: hit.title || '' })
    for (const hit of pageHits) references.push({ module: 'page', label: hit.title || '' })
  }

  return references
}
