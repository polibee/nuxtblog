import { asc, eq } from 'drizzle-orm'
import { getDb, isBlogDbReady } from '../../repositories/db.server'
import {
  authorCertifications,
  authorEducation,
  authorExperiences,
  authorFocusItems,
  authorPageSections,
  authorProfile,
  authorProfileTranslations,
  authorProjects,
  authorSkills,
  authorSocialChannels
} from '../../repositories/schema/profile'
import { media } from '../../repositories/schema/media'
import { bumpAiDomains } from '../ai/optimization/invalidate'
import { findDefaultLocale, listLocales } from '../../repositories/locale.runtime.repository'
import { chooseProfileTranslation, type ProfileTranslation } from './profile-locale'
import { buildVisibleProfileSections, safePublicHttpUrl } from '#shared/schemas/author-card'

/* P29 Profile page: single-author resume/profile. The admin side loads
   everything at once and saves everything at once (one transaction);
   the public side resolves avatar URLs and enabled sections. */

export const SECTION_TYPES = ['about', 'experience', 'projects', 'skills', 'social', 'focus', 'education', 'certifications', 'contact'] as const

export interface ProfileBundle {
  profile: Record<string, unknown>
  translations: Record<string, ProfileTranslation>
  socials: Record<string, unknown>[]
  sections: Record<string, unknown>[]
  experiences: Record<string, unknown>[]
  projects: Record<string, unknown>[]
  skills: Record<string, unknown>[]
  education: Record<string, unknown>[]
  certifications: Record<string, unknown>[]
  focusItems: Record<string, unknown>[]
}

export async function getProfileBundle(): Promise<ProfileBundle> {
  const db = getDb()
  const [profile] = await db.select().from(authorProfile).limit(1)
  const defaultLocale = await findDefaultLocale()
  const locales = await listLocales()
  const translations = profile ? await db.select().from(authorProfileTranslations).where(eq(authorProfileTranslations.profileId, profile.id)) : []
  const localeCodes = new Map(locales.map(locale => [locale.id, locale.code]))
  const translationMap = Object.fromEntries(translations.flatMap((row) => {
    const code = localeCodes.get(row.localeId)
    return code ? [[code, { displayName: row.displayName, headline: row.headline, bio: row.bio ?? '', location: row.location }]] : []
  }))
  const translation = chooseProfileTranslation(new Map(translations.map(row => [row.localeId, row])), defaultLocale?.id)
  const [socials, sections, experiences, projects, skills, education, certifications, focusItems] = await Promise.all([
    db.select().from(authorSocialChannels),
    db.select().from(authorPageSections),
    db.select().from(authorExperiences),
    db.select().from(authorProjects),
    db.select().from(authorSkills),
    db.select().from(authorEducation),
    db.select().from(authorCertifications),
    db.select().from(authorFocusItems)
  ])
  return {
    profile: profile ? { ...profile, ...(translation ?? {}) } : {},
    translations: translationMap,
    socials,
    sections,
    experiences,
    projects,
    skills,
    education,
    certifications,
    focusItems
  }
}

export async function saveProfileBundle(bundle: ProfileBundle): Promise<void> {
  const db = getDb()
  await db.transaction(async (tx) => {
    /* profile: single row upsert */
    const [existing] = await tx.select({ id: authorProfile.id }).from(authorProfile).limit(1)
    const profileValues = {
      avatarMediaId: Number(bundle.profile.avatarMediaId) || null,
      heroConfig: (bundle.profile.heroConfig ?? null) as Record<string, unknown> | null
    }
    let profileId = existing?.id
    if (existing) {
      await tx.update(authorProfile).set(profileValues).where(eq(authorProfile.id, existing.id))
    } else {
      const result = await tx.insert(authorProfile).values(profileValues)
      profileId = result[0]?.insertId
    }
    if (!profileId) throw new Error('profile insert returned no id')
    const defaultLocale = await findDefaultLocale()
    if (!defaultLocale) throw new Error('default locale is required for profile translation')
    const localeRows = await listLocales()
    const submitted = bundle.translations && Object.keys(bundle.translations).length > 0
      ? bundle.translations
      : { [defaultLocale.code]: {
          displayName: String(bundle.profile.displayName ?? ''),
          headline: String(bundle.profile.headline ?? ''),
          bio: String(bundle.profile.bio ?? ''),
          location: String(bundle.profile.location ?? '')
        } }
    for (const locale of localeRows) {
      const values = submitted[locale.code]
      if (!values) continue
      await tx.insert(authorProfileTranslations).values({
        profileId,
        localeId: locale.id,
        displayName: String(values.displayName ?? ''),
        headline: String(values.headline ?? ''),
        bio: values.bio ? String(values.bio) : null,
        location: String(values.location ?? '')
      }).onDuplicateKeyUpdate({ set: {
        displayName: String(values.displayName ?? ''),
        headline: String(values.headline ?? ''),
        bio: values.bio ? String(values.bio) : null,
        location: String(values.location ?? '')
      } })
    }

    /* collections: replace-all per table (small datasets, keeps sort consistent) */
    await tx.delete(authorSocialChannels)
    if (bundle.socials.length > 0) {
      await tx.insert(authorSocialChannels).values(bundle.socials.map((r, i) => ({
        platform: String(r.platform ?? 'custom'),
        url: String(r.url ?? ''),
        handle: String(r.handle ?? ''),
        description: String(r.description ?? ''),
        showInSidebar: false,
        showInHero: Boolean(r.showInHero),
        showInSocial: Boolean(r.showInSocial),
        sortOrder: Number(r.sortOrder ?? i)
      })))
    }

    await tx.delete(authorExperiences)
    if (bundle.experiences.length > 0) {
      await tx.insert(authorExperiences).values(bundle.experiences.map((r, i) => ({
        role: String(r.role ?? ''),
        organization: String(r.organization ?? ''),
        period: String(r.period ?? ''),
        current: Boolean(r.current),
        location: String(r.location ?? ''),
        description: r.description ? String(r.description) : null,
        url: r.url ? String(r.url) : null,
        sortOrder: Number(r.sortOrder ?? i)
      })))
    }

    await tx.delete(authorProjects)
    if (bundle.projects.length > 0) {
      await tx.insert(authorProjects).values(bundle.projects.map((r, i) => ({
        name: String(r.name ?? ''),
        description: r.description ? String(r.description) : null,
        imageMediaId: Number(r.imageMediaId) || null,
        url: r.url ? String(r.url) : null,
        githubUrl: r.githubUrl ? String(r.githubUrl) : null,
        tags: String(r.tags ?? ''),
        featured: Boolean(r.featured),
        sortOrder: Number(r.sortOrder ?? i)
      })))
    }

    await tx.delete(authorSkills)
    if (bundle.skills.length > 0) {
      await tx.insert(authorSkills).values(bundle.skills.map((r, i) => ({
        groupName: String(r.groupName ?? ''),
        name: String(r.name ?? ''),
        sortOrder: Number(r.sortOrder ?? i)
      })))
    }

    await tx.delete(authorEducation)
    if (bundle.education.length > 0) {
      await tx.insert(authorEducation).values(bundle.education.map((r, i) => ({
        school: String(r.school ?? ''),
        program: String(r.program ?? ''),
        period: String(r.period ?? ''),
        details: String(r.details ?? ''),
        sortOrder: Number(r.sortOrder ?? i)
      })))
    }

    await tx.delete(authorCertifications)
    if (bundle.certifications.length > 0) {
      await tx.insert(authorCertifications).values(bundle.certifications.map((r, i) => ({
        name: String(r.name ?? ''),
        issuer: String(r.issuer ?? ''),
        dateIssued: String(r.dateIssued ?? ''),
        url: r.url ? String(r.url) : null,
        sortOrder: Number(r.sortOrder ?? i)
      })))
    }

    await tx.delete(authorFocusItems)
    if (bundle.focusItems.length > 0) {
      await tx.insert(authorFocusItems).values(bundle.focusItems.map((r, i) => ({
        text: String(r.text ?? ''),
        sortOrder: Number(r.sortOrder ?? i)
      })))
    }

    /* sections: upsert by unique type (registry is fixed) */
    for (const s of bundle.sections) {
      const type = String(s.type ?? '')
      if (!type) continue
      const values = {
        type,
        enabled: Boolean(s.enabled),
        sortOrder: Number(s.sortOrder ?? 0)
      }
      const [found] = await tx.select({ id: authorPageSections.id }).from(authorPageSections).where(eq(authorPageSections.type, type)).limit(1)
      if (found) {
        await tx.update(authorPageSections).set(values).where(eq(authorPageSections.id, found.id))
      } else {
        await tx.insert(authorPageSections).values(values)
      }
    }
  })
  await bumpAiDomains(['profile'])
}

export interface PublicProfileSection {
  type: string
  config?: Record<string, unknown> | null
}

export interface PublicProfileExperience {
  role: string
  organization: string
  period: string
  current: boolean
  location: string
  description: string | null
  url: string | null
}

export interface PublicProfileEducation {
  school: string
  program: string
  period: string
  details: string
}

export interface PublicProfileCertification {
  name: string
  issuer: string
  dateIssued: string
  url: string | null
}

export interface PublicProfile {
  displayName: string
  headline: string
  bio: string
  avatar: { url: string, alt: string } | null
  location: string
  heroConfig: Record<string, unknown> | null
  socials: Array<{ platform: string, url: string, handle: string, description: string }>
  heroSocials: Array<{ platform: string, url: string, handle: string, description: string }>
  sections: PublicProfileSection[]
  experiences: PublicProfileExperience[]
  projects: Array<{
    name: string
    description: string
    image: string | null
    url: string
    githubUrl: string
    tags: string[]
    featured: boolean
  }>
  skills: Array<{ group: string, name: string }>
  education: PublicProfileEducation[]
  certifications: PublicProfileCertification[]
  focusItems: string[]
}

export async function getPublicProfile(requestedLocaleId?: number): Promise<PublicProfile | null> {
  if (!isBlogDbReady()) return null
  const db = getDb()
  const [profile] = await db.select().from(authorProfile).limit(1)
  if (!profile) return null
  const defaultLocale = await findDefaultLocale()
  const translations = await db.select().from(authorProfileTranslations).where(eq(authorProfileTranslations.profileId, profile.id))
  const translation = chooseProfileTranslation<ProfileTranslation>(new Map(translations.map(row => [row.localeId, {
    displayName: row.displayName, headline: row.headline, bio: row.bio, location: row.location
  }])), requestedLocaleId, defaultLocale?.id)
  if (!translation) return null

  const [socials, sections, experiences, projects, skills, education, certifications, focusItems] = await Promise.all([
    db.select().from(authorSocialChannels).orderBy(asc(authorSocialChannels.sortOrder)),
    db.select().from(authorPageSections).orderBy(asc(authorPageSections.sortOrder)),
    db.select().from(authorExperiences).orderBy(asc(authorExperiences.sortOrder)),
    db.select().from(authorProjects).orderBy(asc(authorProjects.sortOrder)),
    db.select().from(authorSkills).orderBy(asc(authorSkills.sortOrder)),
    db.select().from(authorEducation).orderBy(asc(authorEducation.sortOrder)),
    db.select().from(authorCertifications).orderBy(asc(authorCertifications.sortOrder)),
    db.select().from(authorFocusItems).orderBy(asc(authorFocusItems.sortOrder))
  ])

  let avatar: { url: string, alt: string } | null = null
  if (profile.avatarMediaId) {
    const [m] = await db.select({ storageKey: media.storageKey }).from(media).where(eq(media.id, profile.avatarMediaId)).limit(1)
    if (m) avatar = { url: `/media/${m.storageKey}`, alt: translation.displayName }
  }

  /* resolve project cover images (batched) */
  const imageIds = [...new Set(projects.map(p => p.imageMediaId).filter((id): id is number => Boolean(id)))]
  const imageMap = new Map<number, string>()
  for (const id of imageIds) {
    const [m] = await db.select({ storageKey: media.storageKey }).from(media).where(eq(media.id, id)).limit(1)
    if (m) imageMap.set(id, `/media/${m.storageKey}`)
  }

  const publicSocials = (show: (social: typeof socials[number]) => boolean) => socials
    .filter(show)
    .map((social) => {
      const url = safePublicHttpUrl(social.url)
      return url
        ? { platform: String(social.platform), url, handle: String(social.handle ?? ''), description: String(social.description ?? '') }
        : null
    })
    .filter((social): social is { platform: string, url: string, handle: string, description: string } => social !== null)

  const publicExperiences: PublicProfileExperience[] = experiences.map(experience => ({
    role: String(experience.role),
    organization: String(experience.organization),
    period: String(experience.period),
    current: Boolean(experience.current),
    location: String(experience.location ?? ''),
    description: experience.description ? String(experience.description) : null,
    url: safePublicHttpUrl(experience.url ?? undefined)
  }))
  const publicProjects = projects.map(project => ({
    name: String(project.name),
    description: project.description ?? '',
    image: project.imageMediaId ? (imageMap.get(project.imageMediaId) ?? null) : null,
    url: safePublicHttpUrl(project.url ?? undefined) ?? '',
    githubUrl: safePublicHttpUrl(project.githubUrl ?? undefined) ?? '',
    tags: project.tags ? project.tags.split(',').map(tag => tag.trim()).filter(Boolean) : [],
    featured: Boolean(project.featured)
  }))
  const publicSkills = skills.map(skill => ({ group: String(skill.groupName), name: String(skill.name) }))
  const publicEducation: PublicProfileEducation[] = education.map(item => ({
    school: String(item.school),
    program: String(item.program),
    period: String(item.period),
    details: String(item.details ?? '')
  }))
  const publicCertifications: PublicProfileCertification[] = certifications.map(certification => ({
    name: String(certification.name),
    issuer: String(certification.issuer),
    dateIssued: String(certification.dateIssued),
    url: safePublicHttpUrl(certification.url ?? undefined)
  }))
  const publicFocusItems = focusItems.map(item => String(item.text ?? '').trim()).filter(Boolean)
  const visibleSections = buildVisibleProfileSections({
    sections: sections.filter(section => section.enabled).map(section => ({
      type: section.type,
      config: (section.config ?? null) as Record<string, unknown> | null
    })),
    bio: translation.bio,
    experiences: publicExperiences,
    projects: publicProjects,
    skills: publicSkills,
    socials: publicSocials(social => social.showInSocial),
    focusItems: publicFocusItems,
    education: publicEducation,
    certifications: publicCertifications
  })
  return {
    displayName: translation.displayName,
    headline: translation.headline,
    bio: translation.bio ?? '',
    avatar,
    location: translation.location,
    heroConfig: (profile.heroConfig ?? null) as Record<string, unknown> | null,
    socials: publicSocials(social => social.showInSocial),
    heroSocials: publicSocials(social => social.showInHero),
    sections: visibleSections,
    experiences: publicExperiences,
    projects: publicProjects,
    skills: publicSkills,
    education: publicEducation,
    certifications: publicCertifications,
    focusItems: publicFocusItems
  }
}
