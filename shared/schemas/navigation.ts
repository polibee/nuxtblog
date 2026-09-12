import { z } from 'zod'

export const NAVIGATION_LOCATIONS = ['header', 'footer'] as const
export const NAVIGATION_ITEM_TYPES = ['page', 'post', 'category', 'custom'] as const

export interface NavigationTreeItemInput {
  label: string
  type: (typeof NAVIGATION_ITEM_TYPES)[number]
  targetEntityType?: 'page' | 'post' | 'category'
  targetEntityId?: number
  customUrl?: string
  titleAttribute?: string
  openInNewTab?: boolean
  rel?: string
  nofollow?: boolean
  enabled?: boolean
  sortOrder?: number
  children?: NavigationTreeItemInput[]
}

export const navigationTreeItemSchema: z.ZodType<NavigationTreeItemInput, z.ZodTypeDef, unknown> = z.lazy(() =>
  z.object({
    label: z.string().trim().min(1).max(120),
    type: z.enum(NAVIGATION_ITEM_TYPES),
    targetEntityType: z.enum(['page', 'post', 'category']).optional(),
    targetEntityId: z.number().int().positive().optional(),
    customUrl: z.string().trim().max(500).optional(),
    titleAttribute: z.string().trim().max(255).optional(),
    openInNewTab: z.boolean().optional(),
    rel: z.string().trim().max(100).optional(),
    nofollow: z.boolean().optional(),
    enabled: z.boolean().optional(),
    sortOrder: z.number().int().min(0).max(9999).optional(),
    children: z.array(navigationTreeItemSchema).optional()
  })
)

export const navigationTreeSchema = z
  .object({
    items: z.array(navigationTreeItemSchema),
    status: z.enum(['published', 'disabled']).optional()
  })
  .strict()

export type NavigationTreeInput = z.infer<typeof navigationTreeSchema>

export interface PublicNavigationItem {
  label: string
  url: string
  titleAttribute: string | null
  target: { type: string, alias: string | null } | null
  rel: string | null
  children: PublicNavigationItem[]
}

export interface PublicNavigation {
  location: string
  locale: string
  fallbackUsed: boolean
  items: PublicNavigationItem[]
}
