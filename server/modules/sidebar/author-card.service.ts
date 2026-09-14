import { createError } from 'h3'
import { authorCardConfigSchema, resolveAuthorCardTranslation, type AuthorCardTranslation } from '#shared/schemas/author-card'
import { listLocales } from '../../repositories/locale.repository'
import { findAuthorCard, saveAuthorCard, type AuthorCardTranslationRow } from '../../repositories/author-card.repository'

function copy(value: Partial<AuthorCardTranslation> | undefined): AuthorCardTranslation {
  return {
    displayName: String(value?.displayName ?? ''),
    headline: String(value?.headline ?? ''),
    bio: String(value?.bio ?? ''),
    ctaLabel: String(value?.ctaLabel ?? '')
  }
}

export async function getAuthorCardAdmin(): Promise<{
  id: number | null
  enabled: boolean
  sortOrder: number
  config: Record<string, unknown> | null
  translations: Record<string, AuthorCardTranslation>
}> {
  const card = await findAuthorCard()
  if (!card) return { id: null, enabled: true, sortOrder: 5, config: null, translations: {} }
  const locales = await listLocales()
  const codeById = new Map(locales.map(locale => [locale.id, locale.code]))
  const config = (card.config ?? null) as Record<string, unknown> | null
  const legacy = copy(config as Partial<AuthorCardTranslation> | null ?? undefined)
  const translations = Object.fromEntries(card.translations.flatMap((row) => {
    const code = codeById.get(row.localeId)
    return code ? [[code, copy(row)]] : []
  }))
  if (Object.keys(translations).length === 0) {
    const defaultLocale = locales.find(locale => locale.isDefault) ?? locales[0]
    if (defaultLocale && legacy.displayName) translations[defaultLocale.code] = legacy
  }
  return { id: card.id, enabled: card.enabled, sortOrder: card.sortOrder, config, translations }
}

export async function saveAuthorCardAdmin(body: unknown): Promise<{ ok: true, id: number }> {
  const input = body as { config?: unknown, enabled?: boolean, sortOrder?: number, translations?: unknown }
  const parsed = authorCardConfigSchema.safeParse(input.config)
  if (!parsed.success) {
    throw createError({ statusCode: 422, statusMessage: parsed.error.issues[0]?.message ?? 'Invalid author card config' })
  }
  const locales = await listLocales()
  const localeByCode = new Map(locales.map(locale => [locale.code, locale]))
  const rawTranslations = input.translations && typeof input.translations === 'object'
    ? input.translations as Record<string, unknown>
    : {}
  const submitted = Object.entries(rawTranslations).map(([code, value]) => {
    const locale = localeByCode.get(code)
    if (!locale || !value || typeof value !== 'object') {
      throw createError({ statusCode: 422, statusMessage: `Unknown author card locale "${code}"` })
    }
    const translation = copy(value as Partial<AuthorCardTranslation>)
    if (!translation.displayName.trim()) {
      throw createError({ statusCode: 422, statusMessage: `Display name is required for ${code}` })
    }
    if (translation.displayName.length > 50 || translation.headline.length > 80 || translation.bio.length > 160 || translation.ctaLabel.length > 30) {
      throw createError({ statusCode: 422, statusMessage: `Author card translation for ${code} is too long` })
    }
    return { localeId: locale.id, ...translation } satisfies AuthorCardTranslationRow
  })
  const defaultLocale = locales.find(locale => locale.isDefault) ?? locales[0]
  if (submitted.length === 0 && defaultLocale) {
    submitted.push({ localeId: defaultLocale.id, ...copy(parsed.data) })
  }
  const id = await saveAuthorCard({
    config: parsed.data,
    enabled: input.enabled ?? true,
    sortOrder: input.sortOrder ?? 5,
    translations: submitted
  })
  return { ok: true, id }
}

export function resolveAuthorCardCopy(
  config: Record<string, unknown>,
  translations: Record<string, AuthorCardTranslation>,
  locale: string,
  defaultLocale: string
): AuthorCardTranslation {
  return resolveAuthorCardTranslation({
    locale,
    defaultLocale,
    translations,
    legacy: copy(config as Partial<AuthorCardTranslation>)
  })
}
