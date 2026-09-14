import { and, asc, desc, eq, isNull, like, or } from 'drizzle-orm'
import { getDb, isBlogDbReady } from '../../repositories/db.server'
import {
  authorProfile,
  authorProjects,
  authorSkills,
  authorSocialChannels
} from '../../repositories/schema/profile'
import { posts, postTranslations } from '../../repositories/schema/posts'
import { pages, pageTranslations } from '../../repositories/schema/pages'
import { categories, tags } from '../../repositories/schema/taxonomy'
import { products } from '../../repositories/schema/products'
import { comments } from '../../repositories/schema/comments'
import { media } from '../../repositories/schema/media'
import { locales } from '../../repositories/schema/locales'
import { listLocales } from '../../repositories/locale.repository'
import { getAdvertisingAnalysis } from '../../repositories/advertising.repository'

/* P30 AI Assistant tools (READ only, §18/27): each tool calls business
   services/repos with narrow projections — never full rows, never
   secrets (§87-90). Namespaced names (§34). */

export interface AiTool {
  name: string
  description: string
  parameters: Record<string, { type: string, description: string, items?: { type: string } }>
  required: string[]
  execute: (args: Record<string, unknown>) => Promise<unknown>
}

function publishedPostsQuery() {
  return getDb().select({
    id: posts.id,
    title: postTranslations.title,
    excerpt: postTranslations.excerpt,
    publishedAt: posts.publishedAt,
    updatedAt: posts.updatedAt
  })
    .from(posts)
    .innerJoin(postTranslations, eq(postTranslations.postId, posts.id))
    .where(and(eq(posts.status, 'published'), isNull(posts.deletedAt)))
    .orderBy(desc(posts.publishedAt))
}

export const AI_TOOLS: AiTool[] = [
  {
    name: 'site.overview',
    description: 'High-level site overview: counts of posts/pages/products/comments, profile, media, locales. Served from the cached site snapshot — cheap and fast (P31 §11)',
    parameters: {},
    required: [],
    execute: async () => {
      /* P31: snapshot artifact instead of a dozen live COUNT queries */
      const { getSiteSnapshot } = await import('./optimization/site-snapshot')
      const snap = await getSiteSnapshot()
      const latest = await publishedPostsQuery().limit(1)
      return {
        postCount: snap.posts.published,
        draftCount: snap.posts.draft,
        missingSeoCount: snap.posts.missingSeo,
        pageCount: snap.pages,
        productCount: snap.products,
        commentCount: snap.comments.approved,
        pendingCommentCount: snap.comments.pending,
        profileExists: snap.profile.exists,
        profileSections: snap.profile.sections,
        mediaCount: snap.media,
        locales: (await listLocales()).map(l => l.code),
        latestPublished: latest[0]?.publishedAt?.toISOString() ?? null
      }
    }
  },
  {
    name: 'advertising.summary',
    description: 'Read-only advertising analysis: campaigns, status, budget spend, impressions, clicks, CTR and active placements. Never changes ads or approvals.',
    parameters: {},
    required: [],
    execute: async () => getAdvertisingAnalysis()
  },
  {
    name: 'content.posts.list',
    description: 'List published posts with id/title/excerpt/dates (up to 100, newest first)',
    parameters: {
      limit: { type: 'integer', description: 'max posts to return (default 20, max 100)' }
    },
    required: [],
    execute: async (args) => {
      const limit = Math.min(Math.max(Number(args.limit) || 20, 1), 100)
      return (await publishedPostsQuery().limit(limit)).map(r => ({
        ...r,
        publishedAt: r.publishedAt?.toISOString() ?? null,
        updatedAt: r.updatedAt?.toISOString() ?? null
      }))
    }
  },
  {
    name: 'content.posts.get',
    description: 'Get one published post: title, excerpt, full text (truncated to 4000 chars)',
    parameters: {
      id: { type: 'integer', description: 'post id' }
    },
    required: ['id'],
    execute: async (args) => {
      const id = Number(args.id)
      const [row] = await getDb()
        .select({
          title: postTranslations.title,
          excerpt: postTranslations.excerpt,
          content: postTranslations.content,
          seoTitle: postTranslations.seoTitle,
          seoDescription: postTranslations.seoDescription,
          publishedAt: posts.publishedAt,
          updatedAt: posts.updatedAt
        })
        .from(postTranslations)
        .innerJoin(posts, eq(postTranslations.postId, posts.id))
        .where(and(eq(posts.id, id), eq(posts.status, 'published')))
        .limit(1)
      if (!row) return null
      return {
        ...row,
        content: row.content.slice(0, 4000),
        publishedAt: row.publishedAt?.toISOString() ?? null,
        updatedAt: row.updatedAt?.toISOString() ?? null
      }
    }
  },
  {
    name: 'content.posts.digest',
    description: 'Cheap digest of one published post: title, summary, keywords, word count, headings — read this instead of the full text when possible (P31 §13)',
    parameters: {
      id: { type: 'integer', description: 'post id' }
    },
    required: ['id'],
    execute: async (args) => {
      const { getPostDigest } = await import('./optimization/digest')
      return getPostDigest(Number(args.id))
    }
  },
  {
    name: 'content.search',
    description: 'Search published post titles/excerpts by keyword',
    parameters: {
      q: { type: 'string', description: 'keyword' }
    },
    required: ['q'],
    execute: async (args) => {
      const q = `%${String(args.q ?? '').trim()}%`
      return getDb()
        .select({ id: posts.id, title: postTranslations.title, excerpt: postTranslations.excerpt })
        .from(postTranslations)
        .innerJoin(posts, eq(postTranslations.postId, posts.id))
        .where(and(
          eq(posts.status, 'published'),
          or(like(postTranslations.title, q), like(postTranslations.excerpt, q))
        ))
        .orderBy(desc(posts.publishedAt))
        .limit(20)
    }
  },
  {
    name: 'pages.list',
    description: 'List pages with title/SEO fields',
    parameters: {},
    required: [],
    execute: async () => getDb()
      .select({
        id: pages.id,
        title: pageTranslations.title,
        seoTitle: pageTranslations.seoTitle,
        seoDescription: pageTranslations.seoDescription
      })
      .from(pageTranslations)
      .innerJoin(pages, eq(pageTranslations.pageId, pages.id))
      .limit(50)
  },
  {
    name: 'seo.summary',
    description: 'SEO health summary: posts missing seoTitle or seoDescription, short descriptions',
    parameters: {},
    required: [],
    execute: async () => {
      const rows = await getDb()
        .select({
          postId: posts.id,
          title: postTranslations.title,
          seoTitle: postTranslations.seoTitle,
          seoDescription: postTranslations.seoDescription
        })
        .from(postTranslations)
        .innerJoin(posts, eq(postTranslations.postId, posts.id))
        .where(eq(posts.status, 'published'))
      return {
        missingTitle: rows.filter(r => !r.seoTitle).map(r => ({ id: r.postId, title: r.title })),
        missingDescription: rows.filter(r => !r.seoDescription).map(r => ({ id: r.postId, title: r.title })),
        shortDescription: rows.filter(r => r.seoDescription && r.seoDescription.length < 50).map(r => ({ id: r.postId, title: r.title }))
      }
    }
  },
  {
    name: 'profile.get',
    description: 'Get the site owner profile: name, headline, bio, socials, skills, projects',
    parameters: {},
    required: [],
    execute: async () => {
      const [profile] = await getDb().select().from(authorProfile).limit(1)
      const socials = await getDb().select().from(authorSocialChannels)
      const skills = await getDb().select().from(authorSkills)
      const projects = await getDb().select({ id: authorProjects.id, name: authorProjects.name, tags: authorProjects.tags }).from(authorProjects)
      return { profile: profile ?? null, socials, skills, projects }
    }
  },
  {
    name: 'taxonomy.list',
    description: 'List categories and tags',
    parameters: {},
    required: [],
    execute: async () => ({
      categories: await getDb().select({ id: categories.id, alias: categories.alias }).from(categories),
      tags: await getDb().select({ id: tags.id, alias: tags.alias }).from(tags)
    })
  },
  {
    name: 'comments.summary',
    description: 'Approved public comments summary (author + excerpt, no emails/IPs)',
    parameters: {},
    required: [],
    execute: async () => {
      const rows = await getDb()
        .select({ authorName: comments.authorName, content: comments.content })
        .from(comments)
        .where(eq(comments.status, 'approved'))
        .limit(50)
      return rows.map(r => ({ author: r.authorName, excerpt: r.content.slice(0, 100) }))
    }
  },
  {
    name: 'store.summary',
    description: 'Store products: name, price info not included — name and description length only',
    parameters: {},
    required: [],
    execute: async () => {
      const rows = await getDb()
        .select({ id: products.id, alias: products.alias, productType: products.productType })
        .from(products)
        .limit(50)
      return rows
    }
  },
  {
    name: 'media.summary',
    description: 'Media library summary: count by usage type',
    parameters: {},
    required: [],
    execute: async () => {
      const rows = await getDb().select({ usageType: media.usageType }).from(media)
      const counts: Record<string, number> = {}
      for (const r of rows) counts[r.usageType] = (counts[r.usageType] ?? 0) + 1
      return counts
    }
  }
]

const TOOL_MAP = new Map(AI_TOOLS.map(t => [t.name, t]))

export function toolDefinitions(prefixes?: string[] | null): Array<{ type: 'function', function: { name: string, description: string, parameters: object } }> {
  const tools = prefixes && prefixes.length > 0
    ? AI_TOOLS.filter(tool => prefixes.some(prefix => tool.name === prefix || tool.name.startsWith(`${prefix}.`)))
    : AI_TOOLS
  return tools.map(tool => ({
    type: 'function' as const,
    function: {
      name: tool.name.replace(/\./g, '__'),
      description: tool.description,
      parameters: {
        type: 'object',
        properties: tool.parameters,
        required: tool.required
      }
    }
  }))
}

export function resolveTool(name: string): AiTool | undefined {
  return TOOL_MAP.get(name.replace(/__/g, '.'))
}

export function isBlogDbReadyForTools(): boolean {
  return isBlogDbReady()
}

export const _schemaGuards = { locales, asc }
