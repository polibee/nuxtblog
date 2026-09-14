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
import enComments from '../../i18n/locales/en/comments'
import enCommon from '../../i18n/locales/en/common'
import enMedia from '../../i18n/locales/en/media'
import enPosts from '../../i18n/locales/en/posts'
import enSettings from '../../i18n/locales/en/settings'
import zhAdmin from '../../i18n/locales/zh-CN/admin'
import zhComments from '../../i18n/locales/zh-CN/comments'
import zhCommon from '../../i18n/locales/zh-CN/common'
import zhMedia from '../../i18n/locales/zh-CN/media'
import zhPosts from '../../i18n/locales/zh-CN/posts'
import zhSettings from '../../i18n/locales/zh-CN/settings'
import { useLocale } from '../../composables/useLocale'

type Locale = 'zh-CN' | 'en'

type Dict = Record<string, string>

export interface LocaleBundle {
  [key: string]: string | LocaleBundle
}

function isLocaleBundle(value: string | LocaleBundle | undefined): value is LocaleBundle {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function mergeLocaleBundleInto(target: LocaleBundle, source: LocaleBundle): LocaleBundle {
  for (const [key, value] of Object.entries(source)) {
    const existing = target[key]
    if (isLocaleBundle(value)) {
      target[key] = mergeLocaleBundleInto(isLocaleBundle(existing) ? { ...existing } : {}, value)
    } else {
      target[key] = value
    }
  }
  return target
}

export function mergeLocaleBundles(...bundles: Dict[]): Dict
export function mergeLocaleBundles(...bundles: LocaleBundle[]): LocaleBundle
export function mergeLocaleBundles(...bundles: LocaleBundle[]): LocaleBundle {
  return bundles.reduce((merged, bundle) => mergeLocaleBundleInto(merged, bundle), {})
}

const messages: Record<Locale, Dict> = {
  'zh-CN': mergeLocaleBundles(zhCommon, zhAdmin, zhPosts, zhComments, zhSettings, zhMedia),
  'en': mergeLocaleBundles(enCommon, enAdmin, enPosts, enComments, enSettings, enMedia)
}

export const LOCALES: Array<{ value: Locale, label: string }> = [
  { value: 'zh-CN', label: '中文' },
  { value: 'en', label: 'English' }
]

export function useI18n() {
  const locale = useCookie<Locale>('admin-locale', { default: () => 'zh-CN' })
  // Public pages have a separate, URL-aware locale state. Keeping the admin
  // preference isolated prevents `/en/...` from rendering English data with
  // Chinese UI labels (or leaking the admin preference into the public site).
  const route = typeof useRoute === 'function' ? useRoute() : null
  const isAdminSurface = route?.path.startsWith('/admin') ?? true
  const publicLocale = isAdminSurface ? null : useLocale().localeCode

  function t(key: string, params?: Record<string, string | number>): string {
    const activeLocale: Locale = publicLocale?.value === 'zh-CN'
      ? 'zh-CN'
      : publicLocale?.value === 'en'
        ? 'en'
        : locale.value
    let text = messages[activeLocale]?.[key] ?? messages.en[key] ?? key
    if (params) {
      for (const [name, value] of Object.entries(params)) {
        text = text.replaceAll(`{${name}}`, String(value))
      }
    }
    return text
  }

  return { locale, t }
}
