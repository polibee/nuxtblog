import { eq } from 'drizzle-orm'
import { getDb } from './db.server'
import { sidebarCards } from './schema/sidebar-cards'
import { authorCardTranslations } from './schema/author-card'
import { locales } from './schema/locales'
import type { AuthorCardConfig, AuthorCardTranslation } from '#shared/schemas/author-card'

export interface AuthorCardTranslationRow extends AuthorCardTranslation {
  localeId: number
}

export interface AuthorCardEntity {
  id: number
  enabled: boolean
  sortOrder: number
  config: unknown
  translations: AuthorCardTranslationRow[]
}

export interface AuthorCardRecord {
  id: number | null
  enabled: boolean
  sortOrder: number
  config: Omit<AuthorCardConfig, 'displayName' | 'headline' | 'bio' | 'cta'> & {
    cta: { url: string, target: 'self' | 'blank' } | null
  } | null
  translations: Record<string, AuthorCardTranslation>
}

function sharedConfig(value: unknown): AuthorCardRecord['config'] {
  const raw = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>
  const cta = raw.cta && typeof raw.cta === 'object' ? raw.cta as Record<string, unknown> : null
  return {
    avatarMediaId: typeof raw.avatarMediaId === 'number' ? raw.avatarMediaId : null,
    avatarStyle: raw.avatarStyle === 'rounded' ? 'rounded' : 'circle',
    layout: raw.layout === 'compact' ? 'compact' : 'centered',
    showAvatar: raw.showAvatar !== false,
    showHeadline: raw.showHeadline !== false,
    showBio: raw.showBio !== false,
    showSocials: raw.showSocials !== false,
    showCta: raw.showCta !== false,
    socialLinks: Array.isArray(raw.socialLinks) ? raw.socialLinks : [],
    cta: cta && typeof cta.url === 'string'
      ? { url: cta.url, target: cta.target === 'blank' ? 'blank' : 'self' }
      : null
  } as AuthorCardRecord['config']
}

export async function listAuthorCardTranslations(cardId: number): Promise<AuthorCardTranslationRow[]> {
  const rows = await getDb().select({
    localeId: authorCardTranslations.localeId,
    displayName: authorCardTranslations.displayName,
    headline: authorCardTranslations.headline,
    bio: authorCardTranslations.bio,
    ctaLabel: authorCardTranslations.ctaLabel
  }).from(authorCardTranslations).where(eq(authorCardTranslations.cardId, cardId))
  return rows
}

export async function findAuthorCard(): Promise<AuthorCardEntity | undefined> {
  const [card] = await getDb().select().from(sidebarCards).where(eq(sidebarCards.type, 'author')).limit(1)
  if (!card) return undefined
  return { ...card, translations: await listAuthorCardTranslations(card.id) }
}

async function loadTranslations(cardId: number): Promise<Record<string, AuthorCardTranslation>> {
  const rows = await getDb().select({
    locale: locales.code,
    localeId: authorCardTranslations.localeId,
    displayName: authorCardTranslations.displayName,
    headline: authorCardTranslations.headline,
    bio: authorCardTranslations.bio,
    ctaLabel: authorCardTranslations.ctaLabel
  }).from(authorCardTranslations)
    .innerJoin(locales, eq(locales.id, authorCardTranslations.localeId))
    .where(eq(authorCardTranslations.cardId, cardId))
  return Object.fromEntries(rows.map(row => [row.locale, {
    displayName: row.displayName,
    headline: row.headline,
    bio: row.bio,
    ctaLabel: row.ctaLabel
  }]))
}

export async function getAuthorCardRecord(): Promise<AuthorCardRecord> {
  const card = await findAuthorCard()
  if (!card) return { id: null, enabled: true, sortOrder: 5, config: null, translations: {} }
  return {
    id: card.id,
    enabled: card.enabled,
    sortOrder: card.sortOrder,
    config: sharedConfig(card.config),
    translations: await loadTranslations(card.id)
  }
}

export async function getAuthorCardTranslation(cardId: number, localeCode: string, defaultLocaleCode: string): Promise<AuthorCardTranslation | undefined> {
  const translations = await loadTranslations(cardId)
  return translations[localeCode] ?? translations[defaultLocaleCode]
}

export async function saveAuthorCardRecord(input: {
  config: AuthorCardRecord['config']
  translations: Array<AuthorCardTranslationRow>
  enabled: boolean
  sortOrder?: number
}): Promise<number> {
  return getDb().transaction(async (tx) => {
    const [existing] = await tx.select({ id: sidebarCards.id }).from(sidebarCards).where(eq(sidebarCards.type, 'author')).limit(1)
    let cardId = existing?.id
    const config = input.config
    if (cardId) {
      await tx.update(sidebarCards).set({ config, enabled: input.enabled, ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}) }).where(eq(sidebarCards.id, cardId))
    } else {
      const [row] = await tx.insert(sidebarCards).values({ type: 'author', config, enabled: input.enabled, sortOrder: input.sortOrder ?? 5 })
      if (!row) throw new Error('author card insert returned no id')
      cardId = row.insertId
    }
    await tx.delete(authorCardTranslations).where(eq(authorCardTranslations.cardId, cardId))
    if (input.translations.length > 0) {
      await tx.insert(authorCardTranslations).values(input.translations.map(translation => ({
        cardId,
        localeId: translation.localeId,
        displayName: translation.displayName,
        headline: translation.headline,
        bio: translation.bio,
        ctaLabel: translation.ctaLabel
      })))
    }
    return cardId
  })
}

/** Compatibility names for the sidebar author-card service contract. */
export async function saveAuthorCard(input: {
  config: AuthorCardConfig
  translations: AuthorCardTranslationRow[]
  enabled: boolean
  sortOrder: number
}): Promise<number> {
  return saveAuthorCardRecord({
    ...input,
    config: sharedConfig(input.config)
  })
}
