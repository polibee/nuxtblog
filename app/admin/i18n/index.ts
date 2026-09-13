/* =============================================================
 * Lightweight i18n: cookie-persisted locale + flat key dictionaries.
 * Business modules resolve their labels at registration time via
 * module factories (t) => ModuleDef; engine-injected labels use
 * render-time t(). Swap with @nuxtjs/i18n later without touching
 * call sites (same useI18n().t contract).
 * Locale sources stay flat and stable: common owns shared/public copy,
 * while admin owns dashboard, resource, and system-management copy.
 * =============================================================
 */

import enAdmin from '../../i18n/locales/en/admin'
import enCommon from '../../i18n/locales/en/common'
import zhAdmin from '../../i18n/locales/zh-CN/admin'
import zhCommon from '../../i18n/locales/zh-CN/common'

type Locale = 'zh-CN' | 'en'

type Dict = Record<string, string>

function mergeLocaleBundles(...bundles: Dict[]): Dict {
  const merged: Dict = {}
  for (const bundle of bundles) {
    Object.assign(merged, bundle)
  }
  return merged
}

const messages: Record<Locale, Dict> = {
  'zh-CN': mergeLocaleBundles(zhCommon, zhAdmin),
  'en': mergeLocaleBundles(enCommon, enAdmin)
}

export const LOCALES: Array<{ value: Locale, label: string }> = [
  { value: 'zh-CN', label: '中文' },
  { value: 'en', label: 'English' }
]

export function useI18n() {
  const locale = useCookie<Locale>('admin-locale', { default: () => 'zh-CN' })

  function t(key: string, params?: Record<string, string | number>): string {
    let text = messages[locale.value]?.[key] ?? messages.en[key] ?? key
    if (params) {
      for (const [name, value] of Object.entries(params)) {
        text = text.replaceAll(`{${name}}`, String(value))
      }
    }
    return text
  }

  return { locale, t }
}
