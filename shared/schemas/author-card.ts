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

const authorSocialLinkSchema = z.object({
  platform: z.enum(AUTHOR_SOCIAL_PLATFORMS),
  url: z.string().trim().min(1).max(500)
    .refine(v => v.startsWith('/') || /^https?:\/\//i.test(v) || v.startsWith('mailto:'), {
      message: 'Social URL must be a site path, http(s) URL or mailto: link'
    }),
  label: z.string().trim().max(50).default('')
})

const authorCtaSharedSchema = z.object({
  url: z.string().trim().min(1).max(500)
    .refine(v => v.startsWith('/') || /^https?:\/\//i.test(v), {
      message: 'CTA URL must be a site path or http(s) URL'
    }),
  target: z.enum(['self', 'blank']).default('self')
}).strict()

/** Non-language fields for the single sidebar author card. */
export const authorCardSharedConfigSchema = z.object({
  avatarMediaId: z.number().int().positive().nullish(),
  avatarStyle: z.enum(['circle', 'rounded']).default('circle'),
  layout: z.enum(['centered', 'compact']).default('centered'),
  showAvatar: z.boolean().default(true),
  showHeadline: z.boolean().default(true),
  showBio: z.boolean().default(true),
  showSocials: z.boolean().default(true),
  showCta: z.boolean().default(true),
  socialLinks: z.array(authorSocialLinkSchema).max(8).default([]),
  cta: authorCtaSharedSchema.nullish()
}).strict()

/** Natural-language fields stored once per locale. */
export const authorCardTranslationSchema = z.object({
  locale: z.string().trim().min(2).max(20),
  displayName: z.string().trim().min(1).max(50),
  headline: z.string().trim().max(80).default(''),
  bio: z.string().trim().max(160).default(''),
  ctaLabel: z.string().trim().max(30).default('')
}).strict()

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
  socialLinks: z.array(authorSocialLinkSchema).max(8).default([]),
  cta: z.object({
    label: z.string().trim().max(30),
    url: z.string().trim().min(1).max(500)
      .refine(v => v.startsWith('/') || /^https?:\/\//i.test(v), {
        message: 'CTA URL must be a site path or http(s) URL'
      }),
    target: z.enum(['self', 'blank']).default('self')
  }).nullish()
}).strict()

export type AuthorCardConfig = z.infer<typeof authorCardConfigSchema>

export interface AuthorCardTranslation {
  displayName: string
  headline: string
  bio: string
  ctaLabel: string
}

export interface AuthorCardTranslationInput {
  locale: string
  defaultLocale: string
  translations: Record<string, AuthorCardTranslation>
  legacy: AuthorCardTranslation
}

/** Resolve localized author-card copy without changing shared visual config. */
export function resolveAuthorCardTranslation(input: AuthorCardTranslationInput): AuthorCardTranslation {
  return input.translations[input.locale]
    ?? input.translations[input.defaultLocale]
    ?? input.legacy
}

export type AuthorCardVariant = 'sidebar' | 'article' | 'profileHero'

export interface AuthorSocial {
  platform: string
  url: string
  label: string
}

export interface AuthorCardSource {
  displayName: string
  profilePath: string
  variant?: AuthorCardVariant
  headline?: string
  bio?: string
  avatar?: { url: string, alt: string } | null
  socials?: AuthorSocial[]
  avatarStyle?: 'circle' | 'rounded'
  layout?: 'centered' | 'compact'
  cta?: { label: string, url: string } | null
}

export interface ResolvedAuthorCard {
  name: string
  profileUrl: string
  headline: string
  bio: string
  avatar: { url: string, alt: string } | null
  avatarStyle: 'circle' | 'rounded'
  layout: 'centered' | 'compact'
  variant: AuthorCardVariant
  socials: AuthorSocial[]
  cta: { label: string, url: string, external: boolean } | null
}

export interface PublicProfileSection {
  type: string
  config?: Record<string, unknown> | null
}

export interface PublicProfileSectionInput {
  sections: PublicProfileSection[]
  bio?: string | null
  experiences?: readonly unknown[]
  projects?: readonly unknown[]
  skills?: readonly unknown[]
  socials?: readonly unknown[]
  focusItems?: readonly unknown[]
  education?: readonly unknown[]
  certifications?: readonly unknown[]
}

function hasUnsafePathCharacters(value: string): boolean {
  return [...value].some((character) => {
    const code = character.charCodeAt(0)
    return code < 0x20 || character === '\\'
  })
}

function safeSitePath(value: string | undefined, fallback: string): string {
  const candidate = value?.trim() ?? ''
  return candidate.startsWith('/') && !candidate.startsWith('//') && !hasUnsafePathCharacters(candidate)
    ? candidate
    : fallback
}

function isPrivateHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, '')
  if (host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal')) return true
  if (host === '::1' || host === '0.0.0.0' || host === '::') return true
  if (/^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host)) return true
  const private172 = host.match(/^172\.(\d{1,3})\./)
  return Boolean(private172 && Number(private172[1]) >= 16 && Number(private172[1]) <= 31)
}

export function safePublicHttpUrl(value: string | undefined): string | null {
  const candidate = value?.trim() ?? ''
  if (!candidate || candidate.startsWith('//') || hasUnsafePathCharacters(candidate)) {
    return candidate.startsWith('/') && !candidate.startsWith('//') ? candidate : null
  }
  try {
    const url = new URL(candidate)
    return (url.protocol === 'http:' || url.protocol === 'https:') && !url.username && !url.password && !isPrivateHostname(url.hostname)
      ? url.toString()
      : null
  } catch {
    return null
  }
}

export function resolvePublicAuthorCard(input: AuthorCardSource): ResolvedAuthorCard {
  const profileUrl = safeSitePath(input.profilePath, '/profile')
  const socials = (input.socials ?? [])
    .map((social) => {
      const url = safePublicHttpUrl(social.url)
      return url ? { platform: social.platform, url, label: social.label.trim() } : null
    })
    .filter((social): social is AuthorSocial => social !== null)
    .slice(0, 8)
  const avatarUrl = safePublicHttpUrl(input.avatar?.url)
  const ctaUrl = safePublicHttpUrl(input.cta?.url ?? undefined)

  return {
    name: input.displayName.trim() || 'Author',
    profileUrl,
    headline: input.headline?.trim() ?? '',
    bio: input.bio?.trim() ?? '',
    avatar: avatarUrl && input.avatar ? { url: avatarUrl, alt: input.avatar.alt.trim() || input.displayName.trim() || 'Author' } : null,
    avatarStyle: input.avatarStyle === 'rounded' ? 'rounded' : 'circle',
    layout: input.layout === 'compact' ? 'compact' : 'centered',
    variant: input.variant ?? 'sidebar',
    socials,
    cta: ctaUrl && input.cta
      ? { label: input.cta.label.trim() || 'View profile', url: ctaUrl, external: /^https?:\/\//i.test(ctaUrl) }
      : null
  }
}

export function buildVisibleProfileSections(input: PublicProfileSectionInput): PublicProfileSection[] {
  const has = (value: unknown): boolean => Array.isArray(value) ? value.length > 0 : Boolean(typeof value === 'string' ? value.trim() : value)
  const content: Record<string, unknown> = {
    about: input.bio,
    experience: input.experiences,
    projects: input.projects,
    skills: input.skills,
    social: input.socials,
    contact: input.socials,
    focus: input.focusItems,
    education: input.education,
    certifications: input.certifications
  }
  return input.sections.filter(section => has(content[section.type]))
}
