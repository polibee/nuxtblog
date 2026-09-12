import { z } from 'zod'
import { translationsRecordSchema } from './locale'

/** usage classification (media.txt §4): machine values, one per asset */
export const MEDIA_USAGE_TYPES = [
  'general',
  'post_content',
  'post_featured',
  'page_content',
  'slider',
  'advertising',
  'avatar',
  'site_logo',
  'og_image'
] as const

export const mediaUpdateSchema = z
  .object({
    filename: z.string().trim().min(1).max(255).optional(),
    folderId: z.number().int().positive().nullable().optional(),
    usageType: z.enum(MEDIA_USAGE_TYPES).optional(),
    translations: translationsRecordSchema.optional()
  })
  .strict()

export type MediaUpdateInput = z.infer<typeof mediaUpdateSchema>

/** per-locale fields the admin can edit for one media item */
export const MEDIA_TRANSLATION_FIELDS = ['alt', 'caption'] as const

export const MAX_MEDIA_SIZE = 10 * 1024 * 1024
