/* P31 Entity Digest (缓存优化 §13/14): cheap (0 token) digests so the
   assistant reads summaries instead of full bodies. Stored as artifacts
   keyed on the content fingerprint — a content edit re-fingerprints and
   the digest regenerates on next read. AI-generated summaries are a
   later upgrade; the first version is fully deterministic. */

import { eq, inArray } from 'drizzle-orm'
import { getDb, isBlogDbReady } from '../../../repositories/db.server'
import { postTranslations } from '../../../repositories/schema/posts'
import { relationsForPost } from '../../../repositories/taxonomy.repository'
import { withArtifact } from './artifact-cache'
import { sha256 } from './fingerprint'

export interface PostDigest {
  id: number
  title: string
  summary: string
  keywords: string[]
  wordCount: number
  headings: string[]
}

function extractHeadings(content: string): string[] {
  const headings: string[] = []
  const re = /^##\s+(.+)$/gm
  let match = re.exec(content)
  while (match && headings.length < 20) {
    headings.push(match[1]!.trim())
    match = re.exec(content)
  }
  return headings
}

export async function getPostDigest(postId: number): Promise<PostDigest | null> {
  if (!isBlogDbReady()) return null
  const [row] = await getDb()
    .select({
      title: postTranslations.title,
      excerpt: postTranslations.excerpt,
      content: postTranslations.content
    })
    .from(postTranslations)
    .where(eq(postTranslations.postId, postId))
    .limit(1)
  if (!row) return null

  const content = row.content ?? ''
  const fingerprint = sha256(`digest:${row.title}:${content.length}:${content.slice(0, 500)}:${content.slice(-200)}`)
  const { payload } = await withArtifact<PostDigest>(
    { entityType: 'post', entityId: String(postId), artifactType: 'content_digest', fingerprint },
    async () => {
      const plain = content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
      let keywords: string[] = []
      try {
        const relations = await relationsForPost(postId)
        if (relations.tagIds.length > 0) {
          const { tagTranslations } = await import('../../../repositories/schema/taxonomy')
          const rows = await getDb()
            .select({ name: tagTranslations.name })
            .from(tagTranslations)
            .where(inArray(tagTranslations.entityId, relations.tagIds))
          keywords = [...new Set(rows.map(r => r.name))].slice(0, 10)
        }
      } catch { /* tags are optional for the digest */ }
      return {
        payload: {
          id: postId,
          title: row.title ?? '',
          summary: row.excerpt || plain.slice(0, 300),
          keywords,
          wordCount: plain.split(' ').filter(Boolean).length,
          headings: extractHeadings(content)
        },
        expiresAt: null
      }
    }
  )
  return payload
}
