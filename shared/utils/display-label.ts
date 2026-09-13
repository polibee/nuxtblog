export interface DisplayLabelInput {
  locale: string
  defaultLabel: string
  localizedLabel?: string | null
  alias?: string | null
  systemKey?: string | null
  defaultLocale?: string
}

/** Resolve labels consistently without coupling presentation to routing. */
export function resolveDisplayLabel(input: DisplayLabelInput): string {
  const clean = (value: string | null | undefined): string => String(value ?? '').trim()
  const defaultLocale = input.defaultLocale ?? 'zh-CN'
  const localized = clean(input.localizedLabel)
  const defaultLabel = clean(input.defaultLabel)
  const alias = clean(input.alias)
  const systemKey = clean(input.systemKey)
  if (input.locale !== defaultLocale) return localized || alias || systemKey || defaultLabel || 'item'
  return defaultLabel || alias || systemKey || localized || 'item'
}
