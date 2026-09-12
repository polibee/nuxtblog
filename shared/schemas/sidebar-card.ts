import { z } from 'zod'

export const SIDEBAR_CARD_TYPES = ['html', 'link', 'image_link', 'js_ad', 'latest_posts', 'membership_plans', 'article_toc', 'ad_slot', 'author'] as const

/** content length rule varies by type: js_ad/link allow small payloads;
    html/image_link keep the original min(1) rule via superRefine */
export const sidebarCardInputSchema = z
  .object({
    type: z.enum(SIDEBAR_CARD_TYPES).optional(),
    enabled: z.boolean().optional(),
    sortOrder: z.number().int().min(0).max(9999).optional(),
    linkUrl: z.string().trim().max(500).refine(v => v === '' || v.startsWith('/') || /^https?:\/\//.test(v), { message: 'linkUrl must be a URL or site-relative path' }).nullish(),
    imageMediaId: z.number().int().positive().nullish(),
    translations: z
      .record(
        z.string(),
        z.object({
          title: z.string().trim().min(1).max(200),
          content: z.string().min(1)
        })
      )
      .refine(entries => Object.keys(entries).length > 0, {
        message: 'at least one locale translation is required'
      })
  })
  .strict()

export type SidebarCardInput = z.infer<typeof sidebarCardInputSchema>

export interface PublicSidebarCard {
  id: number
  type: string
  title: string
  content: string
  sortOrder: number
  linkUrl?: string | null
  imageUrl?: string | null
  /** latest_posts: programmatic card payload */
  items?: Array<{ title: string, alias: string }>
  /** membership_plans: programmatic card payload */
  plans?: Array<{ id: number, name: string, description: string | null, priceMinor: number, currency: string, period: string, productAlias: string }>
  /** ad_slot: advertising slot key stored in content */
  /** author: resolved author card (config JSON → visual payload) */
  author?: import('./author-card').ResolvedAuthorCard
}
