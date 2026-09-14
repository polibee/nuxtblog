import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  authorCardSharedConfigSchema,
  authorCardTranslationSchema,
  buildVisibleProfileSections,
  resolvePublicAuthorCard,
  resolveAuthorCardTranslation,
  type PublicProfileSectionInput
} from '../../shared/schemas/author-card'

describe('public author card view model', () => {
  it('models localized copy separately from shared author-card configuration', () => {
    expect(authorCardSharedConfigSchema.parse({
      avatarMediaId: 12,
      avatarStyle: 'circle',
      layout: 'centered',
      showAvatar: true,
      showHeadline: true,
      showBio: true,
      showSocials: true,
      showCta: true,
      socialLinks: [{ platform: 'github', url: 'https://github.com/lee', label: '' }],
      cta: { url: '/about', target: 'self' }
    })).toEqual(expect.objectContaining({ avatarMediaId: 12 }))

    expect(authorCardTranslationSchema.parse({
      locale: 'en',
      displayName: 'Lee',
      headline: 'Developer',
      bio: 'Builds useful things.',
      ctaLabel: 'View profile'
    })).toEqual({
      locale: 'en',
      displayName: 'Lee',
      headline: 'Developer',
      bio: 'Builds useful things.',
      ctaLabel: 'View profile'
    })
  })

  it('prefers the requested author-card translation and falls back to the default locale', () => {
    expect(resolveAuthorCardTranslation({
      locale: 'en',
      defaultLocale: 'zh-CN',
      translations: {
        'zh-CN': { displayName: '作者', headline: '开发者', bio: '中文简介', ctaLabel: '查看主页' },
        'en': { displayName: 'Author', headline: 'Developer', bio: 'English bio', ctaLabel: 'View profile' }
      },
      legacy: { displayName: '旧作者', headline: '旧身份', bio: '旧简介', ctaLabel: '旧按钮' }
    })).toEqual({ displayName: 'Author', headline: 'Developer', bio: 'English bio', ctaLabel: 'View profile' })

    expect(resolveAuthorCardTranslation({
      locale: 'fr',
      defaultLocale: 'zh-CN',
      translations: { 'zh-CN': { displayName: '作者', headline: '', bio: '', ctaLabel: '' } },
      legacy: { displayName: '旧作者', headline: '旧身份', bio: '旧简介', ctaLabel: '旧按钮' }
    })).toEqual({ displayName: '作者', headline: '', bio: '', ctaLabel: '' })
  })

  it('adds a safe site-relative profile URL to the author card', () => {
    expect(resolvePublicAuthorCard({ displayName: 'Lee', profilePath: '/profile' }).profileUrl).toBe('/profile')
  })

  it('drops unsafe profile paths and social protocols from public output', () => {
    const card = resolvePublicAuthorCard({
      displayName: 'Lee',
      profilePath: 'https://attacker.example/profile',
      socials: [
        { platform: 'github', url: 'https://github.com/lee', label: 'GitHub' },
        { platform: 'custom', url: 'javascript:alert(1)', label: 'Unsafe' },
        { platform: 'email', url: 'mailto:lee@example.com', label: 'Email' }
      ]
    })

    expect(card.profileUrl).toBe('/profile')
    expect(card.socials).toEqual([
      { platform: 'github', url: 'https://github.com/lee', label: 'GitHub' }
    ])
  })

  it('does not expose private profile fields while resolving the card', () => {
    const card = resolvePublicAuthorCard({
      displayName: 'Lee',
      profilePath: '/profile',
      headline: 'Builder',
      bio: 'Public bio',
      email: 'lee@example.com',
      role: 'admin'
    } as never)

    expect(card).toEqual(expect.objectContaining({ name: 'Lee', headline: 'Builder', bio: 'Public bio' }))
    expect(card).not.toHaveProperty('email')
    expect(card).not.toHaveProperty('role')
  })
})

describe('public profile section composition', () => {
  it('does not render an empty profile section', () => {
    expect(buildVisibleProfileSections({ sections: [{ type: 'about' }], bio: '' })).toEqual([])
  })

  it('keeps configured order and omits sections without public content', () => {
    const input: PublicProfileSectionInput = {
      sections: [
        { type: 'projects' },
        { type: 'about' },
        { type: 'social' },
        { type: 'focus' }
      ],
      bio: 'A public biography',
      projects: [{ name: 'NuxtBlog' }],
      socials: [{ platform: 'github', url: 'https://github.com/lee', handle: 'lee', description: '' }],
      focusItems: []
    }

    expect(buildVisibleProfileSections(input).map(section => section.type)).toEqual([
      'projects',
      'about',
      'social'
    ])
  })
})

describe('public profile layout composition', () => {
  it('keeps the profile page focused on personal information without article content', () => {
    const page = readFileSync(resolve(process.cwd(), 'app/pages/profile.vue'), 'utf8')
    expect(page).not.toContain('<ProfileHero')
    expect(page).not.toContain('<SidebarCards')
    expect(page).not.toContain('to="/posts"')
    expect(page).not.toContain('\'/api/public/posts\'')
    expect(page).toContain('visibleSections')
    expect(page).toContain('<ProfileProjectCard')
  })

  it('keeps project media SSR-safe and provides an accessible placeholder', () => {
    const card = readFileSync(resolve(process.cwd(), 'app/components/public/ProfileProjectCard.vue'), 'utf8')
    expect(card).toContain('v-if="project.image"')
    expect(card).toContain('aria-label')
    expect(card).toContain('createProjectPlaceholder')
  })

  it('renders loading and error states around the public profile request', () => {
    const page = readFileSync(resolve(process.cwd(), 'app/pages/profile.vue'), 'utf8')
    expect(page).toContain('status === \'pending\'')
    expect(page).toContain('error')
    expect(page).toContain('t(\'public.profile.retry\')')
    expect(page).toContain('refresh')
  })
})

describe('author card boundaries', () => {
  it('keeps AuthorCardView isolated to the legacy sidebar contract', () => {
    const card = readFileSync(resolve(process.cwd(), 'app/components/public/AuthorCardView.vue'), 'utf8')
    const sidebar = readFileSync(resolve(process.cwd(), 'app/components/public/SidebarCards.vue'), 'utf8')
    expect(card).toContain('avatarStyle?:')
    expect(card).toContain('layout?: \'centered\' | \'compact\'')
    expect(card).toContain('socials?: AuthorSocial[]')
    expect(card).toContain('profileUrl?: string')
    expect(sidebar).toContain('import PublicAuthorCard from \'~/components/public/AuthorCardView.vue\'')
    expect(sidebar).toContain('<PublicAuthorCard')
    expect(sidebar).toContain(':profile-url="card.author.profileUrl"')
    expect(sidebar).not.toContain(':variant=')
  })

  it('renders the locale-aware standalone author card on article pages', () => {
    const page = readFileSync(resolve(process.cwd(), 'app/pages/posts/[alias].vue'), 'utf8')
    const card = readFileSync(resolve(process.cwd(), 'app/components/public/ArticleAuthorCard.vue'), 'utf8')
    expect(page).toContain('import ArticleAuthorCard from \'~/components/public/ArticleAuthorCard.vue\'')
    expect(page).toContain('<ArticleAuthorCard')
    expect(page).not.toContain('<AuthorCardView')
    expect(page).not.toContain('variant="article"')
    expect(card).toContain('profileUrl?: string')
    expect(card).toContain('socials?: AuthorSocial[]')
    expect(card).not.toContain('headline')
    expect(card).not.toContain('bio')
    expect(page).toContain('\'/api/public/profile\'')
    expect(page).toContain(':socials="authorSocials"')
    expect(page).toContain('query: { locale: localeCode.value }')
  })
})

describe('public service view models', () => {
  it('uses the safe author-card resolver for sidebar author payloads', () => {
    const service = readFileSync(resolve(process.cwd(), 'server/modules/sidebar/sidebar-card.service.ts'), 'utf8')
    expect(service).toContain('resolvePublicAuthorCard')
    expect(service).toContain('profilePath:')
  })

  it('uses explicit public profile mappings and omits empty sections', () => {
    const service = readFileSync(resolve(process.cwd(), 'server/modules/profile/profile.service.ts'), 'utf8')
    expect(service).toContain('safePublicHttpUrl')
    expect(service).toContain('buildVisibleProfileSections')
    expect(service).toMatch(/sections:\s*(?:visibleSections|buildVisibleProfileSections\s*\()/)
    expect(service).not.toContain('experiences: experiences.map(e => ({ ...e }))')
    expect(service).not.toContain('education: education.map(e => ({ ...e }))')
    expect(service).not.toContain('certifications: certifications.map(c => ({ ...c }))')
  })
})
