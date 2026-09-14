export interface DisplayLabelInput {
  locale: string
  defaultLabel: string
  localizedLabel?: string | null
  alias?: string | null
  systemKey?: string | null
  defaultLocale?: string
}

/** Keep English navigation labels readable without changing their casing
 * beyond the first character (for example `about us` → `About us`). */
export function capitalizeEnglishLabel(value: string): string {
  const text = value.trim()
  if (!text) return ''
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/** Resolve labels consistently without coupling presentation to routing. */
export function resolveDisplayLabel(input: DisplayLabelInput): string {
  const clean = (value: string | null | undefined): string => String(value ?? '').trim()
  const defaultLocale = input.defaultLocale ?? 'zh-CN'
  const localized = clean(input.localizedLabel)
  const defaultLabel = clean(input.defaultLabel)
  const alias = clean(input.alias)
  const systemKey = clean(input.systemKey)
  if (input.locale !== defaultLocale) {
    const value = localized || alias || systemKey || defaultLabel || 'item'
    return /^en(?:-|$)/iu.test(input.locale) ? capitalizeEnglishLabel(value) : value
  }
  return defaultLabel || alias || systemKey || localized || 'item'
}
