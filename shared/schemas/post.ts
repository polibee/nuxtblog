import { z } from 'zod'

export const POST_STATUSES = ['draft', 'scheduled', 'published', 'archived'] as const
export const POST_ACCESS_TYPES = ['public', 'members', 'paid'] as const

export type PostStatus = (typeof POST_STATUSES)[number]
export type PostAccessType = (typeof POST_ACCESS_TYPES)[number]

/** alias rule (alias unification doc 2.1): lowercase letters, digits, dashes */
export const aliasSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'lowercase letters, digits and dashes only')

/** paths that content aliases must never occupy */
export const RESERVED_ALIASES = [
  'admin', 'api', 'posts', 'pages', 'category', 'tag', 'preview',
  'sitemap.xml', 'rss.xml', 'login', 'reset-password'
] as const

export function isReservedAlias(alias: string): boolean {
  return (RESERVED_ALIASES as readonly string[]).includes(alias)
}

export function assertValidAlias(alias: string): void {
  if (isReservedAlias(alias)) {
    throw new Error(`Alias "${alias}" is a reserved path`)
  }
}

/** post translation fields carry human-readable content only — no slug */
export const postTranslationFieldsSchema = z.object({
  title: z.string().trim().min(1).max(255),
  excerpt: z.string().max(500).optional(),
  content: z.string().optional(),
  seoTitle: z.string().max(255).optional(),
  seoDescription: z.string().max(500).optional(),
  canonicalUrl: z.string().trim().url().max(500).nullish(),
  noindex: z.boolean().optional()
}).strict()

export type PostTranslationFields = z.infer<typeof postTranslationFieldsSchema>

export const postInputSchema = z
  .object({
    alias: aliasSchema.optional(),
    status: z.enum(POST_STATUSES).optional(),
    accessType: z.enum(POST_ACCESS_TYPES).optional(),
    paidPriceMinor: z.number().int().min(1).max(10_000_000).nullish(),
    paidCurrency: z.enum(['USD', 'CNY', 'EUR']).nullish(),
    scheduledAt: z.string().datetime().nullish(),
    featuredMediaId: z.number().int().positive().nullish(),
    commentStatus: z.enum(['open', 'closed']).optional(),
    categoryIds: z.array(z.number().int().positive()).optional(),
    tagIds: z.array(z.number().int().positive()).optional(),
    translations: z.record(z.string(), postTranslationFieldsSchema).optional()
  })
  .strict()

export type PostInput = z.infer<typeof postInputSchema>

export const taxonomyTranslationFieldsSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().max(500).optional()
})

export const taxonomyInputSchema = z
  .object({
    alias: aliasSchema.optional(),
    translations: z
      .record(z.string(), taxonomyTranslationFieldsSchema)
      .refine(entries => Object.keys(entries).length > 0, {
        message: 'at least one locale translation is required'
      })
  })
  .strict()

export type TaxonomyInput = z.infer<typeof taxonomyInputSchema>

/** publish gate (architecture §8.4): primary locale must be complete */
export const POST_PUBLISH_REQUIRED_FIELDS = ['title', 'content'] as const

/** derive an alias from a title; falls back to a timestamp alias */
export function slugifyTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120)
}

export function ensureAlias(title: string, provided: string | undefined): string {
  const alias = (provided ?? '').trim() || slugifyTitle(title)
  return alias || `p-${Date.now()}`
}
