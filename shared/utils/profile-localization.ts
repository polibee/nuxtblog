export interface ProfileTranslationValues {
  displayName: string
  headline: string
  bio: string
  location: string
}

export function emptyProfileTranslation(): ProfileTranslationValues {
  return { displayName: '', headline: '', bio: '', location: '' }
}

export function buildProfileTranslationMap(
  input: Record<string, Partial<ProfileTranslationValues>>
): Record<string, ProfileTranslationValues> {
  return Object.fromEntries(Object.entries(input).map(([code, value]) => [code, {
    displayName: String(value.displayName ?? ''),
    headline: String(value.headline ?? ''),
    bio: String(value.bio ?? ''),
    location: String(value.location ?? '')
  }]))
}

export function chooseProfileTranslationCode(
  availableCodes: string[],
  requestedCode: string,
  defaultCode: string
): string | undefined {
  return availableCodes.includes(requestedCode)
    ? requestedCode
    : availableCodes.includes(defaultCode)
      ? defaultCode
      : availableCodes[0]
}
