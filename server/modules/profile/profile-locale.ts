export interface ProfileTranslation {
  displayName: string
  headline: string
  bio: string | null
  location: string
}

export function chooseProfileTranslation<T>(
  translations: Map<number, T>,
  requestedLocaleId?: number,
  defaultLocaleId?: number
): T | undefined {
  if (requestedLocaleId !== undefined && translations.has(requestedLocaleId)) return translations.get(requestedLocaleId)
  if (defaultLocaleId !== undefined && translations.has(defaultLocaleId)) return translations.get(defaultLocaleId)
  return translations.values().next().value as T | undefined
}
