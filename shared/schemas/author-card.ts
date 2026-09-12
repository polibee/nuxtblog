import { z } from 'zod'

/* Author sidebar card (docs Author Card 设计方案): visual form in the
   admin, config JSON only as the storage layer — never hand-edited. */

export const AUTHOR_SOCIAL_PLATFORMS = [
  'github',
  'x',
  'linkedin',
  'website',
  'email',
  'youtube',
  'telegram',
  'discord',
  'rss',
  'custom'
] as const

export const authorCardConfigSchema = z.object({
  displayName: z.string().trim().min(1).max(50),
  headline: z.string().trim().max(80).default(''),
  bio: z.string().trim().max(160).default(''),
  avatarMediaId: z.number().int().positive().nullish(),
  avatarStyle: z.enum(['circle', 'rounded']).default('circle'),
  layout: z.enum(['centered', 'compact']).default('centered'),
  showAvatar: z.boolean().default(true),
  showHeadline: z.boolean().default(true),
  showBio: z.boolean().default(true),
  showSocials: z.boolean().default(true),
  showCta: z.boolean().default(true),
  socialLinks: z.array(z.object({
    platform: z.enum(AUTHOR_SOCIAL_PLATFORMS),
    url: z.string().trim().min(1).max(500)
      .refine(v => v.startsWith('/') || /^https?:\/\//i.test(v) || v.startsWith('mailto:'), {
        message: 'Social URL must be a site path, http(s) URL or mailto: link'
      }),
    label: z.string().trim().max(50).default('')
  })).max(8).default([]),
  cta: z.object({
    label: z.string().trim().min(1).max(30),
    url: z.string().trim().min(1).max(500)
      .refine(v => v.startsWith('/') || /^https?:\/\//i.test(v), {
        message: 'CTA URL must be a site path or http(s) URL'
      }),
    target: z.enum(['self', 'blank']).default('self')
  }).nullish()
}).strict()

export type AuthorCardConfig = z.infer<typeof authorCardConfigSchema>

export interface AuthorSocial {
  platform: string
  url: string
  label: string
}

export interface ResolvedAuthorCard {
  name: string
  headline: string
  bio: string
  avatar: { url: string, alt: string } | null
  avatarStyle: 'circle' | 'rounded'
  layout: 'centered' | 'compact'
  socials: AuthorSocial[]
  cta: { label: string, url: string, external: boolean } | null
}
