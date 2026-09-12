import type { TranslationsRecord } from '#shared/types/locale'
import { listLocales } from '../repositories/locale.runtime.repository'

/** records expose translations[localeCode][field]; storage is locale-id keyed */
export async function withCodeKeyedTranslations<T extends { translations: TranslationsRecord }>(
  record: T
): Promise<T> {
  const locales = await listLocales()
  const idToCode = new Map(locales.map(l => [String(l.id), l.code]))
  const translations: TranslationsRecord = {}
  for (const [key, value] of Object.entries(record.translations)) {
    const code = idToCode.get(key)
    if (code) translations[code] = value
  }
  return { ...record, translations }
}

export async function withCodeKeyedTranslationsAll<T extends { translations: TranslationsRecord }>(
  records: T[]
): Promise<T[]> {
  const locales = await listLocales()
  const idToCode = new Map(locales.map(l => [String(l.id), l.code]))
  return records.map((record) => {
    const translations: TranslationsRecord = {}
    for (const [key, value] of Object.entries(record.translations)) {
      const code = idToCode.get(key)
      if (code) translations[code] = value
    }
    return { ...record, translations }
  })
}
