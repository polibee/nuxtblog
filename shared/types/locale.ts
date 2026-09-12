export interface LocaleSummary {
  id: number
  code: string
  name: string
  nativeName: string
  urlPrefix: string | null
  enabled: boolean
  contentEnabled: boolean
  uiEnabled: boolean
  isDefault: boolean
  sortOrder: number
}

/** locale attached to a request; id is null when the registry is unavailable (degraded mode) */
export interface ResolvedLocale {
  id: number | null
  code: string
  urlPrefix: string
}

export type TranslationCompleteness = 'missing' | 'incomplete' | 'complete'

/** value shape of a `localized` admin field: translations[localeCode][field] */
export type TranslationsRecord = Record<string, Record<string, unknown>>
