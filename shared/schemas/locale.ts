import { z } from 'zod'
import type { TranslationCompleteness, TranslationsRecord } from '../types/locale'

/* =============================================================
 * Locale registry + Entity/Translation shared rules.
 * Used by server validation AND admin UI; must stay framework-free.
 * ============================================================= */

export const localeCodeSchema = z
  .string()
  .min(2)
  .max(20)
  .regex(/^[a-zA-Z]{2,3}(-[a-zA-Z0-9]{2,8})*$/, 'invalid locale code')

export const localeUrlPrefixSchema = z
  .string()
  .max(20)
  .regex(/^[a-z0-9-]*$/, 'lowercase letters, digits and dashes only')

export const localeInputSchema = z
  .object({
    code: localeCodeSchema,
    name: z.string().min(1).max(80),
    nativeName: z.string().min(1).max(80),
    urlPrefix: localeUrlPrefixSchema.nullish(),
    enabled: z.boolean().optional(),
    contentEnabled: z.boolean().optional(),
    uiEnabled: z.boolean().optional(),
    isDefault: z.boolean().optional(),
    sortOrder: z.number().int().min(0).max(9999).optional()
  })
  .strict()

export type LocaleInput = z.infer<typeof localeInputSchema>

/** value shape of a `localized` admin field */
export const translationsRecordSchema: z.ZodType<TranslationsRecord> = z.record(
  z.string(),
  z.record(z.string(), z.unknown())
)

/** completeness of ONE locale's translation against required fields */
export function localeTranslationCompleteness(
  fields: Record<string, unknown> | undefined,
  requiredFields: string[]
): TranslationCompleteness {
  if (!fields) return 'missing'
  const incomplete = requiredFields.some((field) => {
    const value = fields[field]
    if (value === undefined || value === null) return true
    if (typeof value === 'string' && value.replace(/<[^>]*>/g, '').trim() === '') return true
    return false
  })
  return incomplete ? 'incomplete' : 'complete'
}

/** per-locale map for badges in the admin UI */
export function translationCompletenessByLocale(
  translations: TranslationsRecord | undefined,
  requiredFields: string[]
): Record<string, TranslationCompleteness> {
  const result: Record<string, TranslationCompleteness> = {}
  for (const locale of Object.keys(translations ?? {})) {
    result[locale] = localeTranslationCompleteness(translations?.[locale], requiredFields)
  }
  return result
}

/**
 * Publish rule (architecture §8.4): an entity is publishable only when
 * its primary locale translation is complete.
 */
export function isPublishable(
  translations: TranslationsRecord | undefined,
  primaryLocale: string,
  requiredFields: string[]
): boolean {
  return localeTranslationCompleteness(translations?.[primaryLocale], requiredFields) === 'complete'
}
