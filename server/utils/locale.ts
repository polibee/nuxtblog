import { isBlogDbReady } from '../repositories/db.server'
import { listLocales } from '../repositories/locale.repository'
import type { LocaleSummary, ResolvedLocale } from '#shared/types/locale'

/* =============================================================
 * Locale resolution for the blog framework.
 *
 * Rules (architecture doc §10):
 *   1. URL prefix (/en/...) when the locale has content enabled
 *   2. Accept-Language against enabled+content locales
 *   3. default locale (is_default), no url prefix
 *
 * The registry lives in MySQL; when the DB is unavailable we degrade
 * to the constant default below instead of failing the request.
 * Public content queries must always receive the resolved locale
 * explicitly and cache keys must include it.
 * ============================================================= */

const DEGRADED_DEFAULT: ResolvedLocale = { id: null, code: 'zh-CN', urlPrefix: '' }

const CACHE_TTL_MS = 60_000
let cache: { at: number, locales: LocaleSummary[] } | null = null

/** P02 locale writes must call this to drop the short-lived cache */
export function invalidateLocaleCache(): void {
  cache = null
}

async function activeLocales(): Promise<LocaleSummary[]> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.locales
  if (!isBlogDbReady()) return []
  try {
    const locales = await listLocales({ enabledOnly: true })
    cache = { at: Date.now(), locales }
    return locales
  } catch {
    return []
  }
}

export function contentLocales(locales: LocaleSummary[]): LocaleSummary[] {
  return locales.filter(l => l.enabled && l.contentEnabled)
}

/** first URL segment match: "/en/posts" -> locale with url_prefix "en" */
export function matchLocaleByPathPrefix(
  path: string,
  locales: LocaleSummary[]
): LocaleSummary | undefined {
  if (!path.startsWith('/')) return undefined
  const segment = path.slice(1).split(/[?#]/)[0]?.split('/')[0] ?? ''
  if (!segment) return undefined
  return contentLocales(locales).find(l => l.urlPrefix === segment)
}

/** pick the best enabled+content locale from an Accept-Language header */
export function matchLocaleFromAcceptLanguage(
  header: string | undefined,
  locales: LocaleSummary[]
): LocaleSummary | undefined {
  if (!header) return undefined
  const candidates = contentLocales(locales)
  if (candidates.length === 0) return undefined
  const wanted = header
    .split(',')
    .map((part) => {
      const [tag, ...params] = part.trim().split(';')
      const q = params.find(p => p.trim().startsWith('q='))
      return { tag: (tag ?? '').trim().toLowerCase(), q: q ? Number(q.split('=')[1]) || 0 : 1 }
    })
    .filter(entry => entry.tag.length > 0)
    .sort((a, b) => b.q - a.q)
  for (const { tag } of wanted) {
    const exact = candidates.find(l => l.code.toLowerCase() === tag)
    if (exact) return exact
    const base = tag.split('-')[0] ?? ''
    if (!base) continue
    const prefix = candidates.find(l => l.code.toLowerCase().split('-')[0] === base)
    if (prefix) return prefix
  }
  return undefined
}

export function defaultLocale(locales: LocaleSummary[]): LocaleSummary | undefined {
  return locales.find(l => l.enabled && l.isDefault)
    ?? contentLocales(locales)[0]
}

function toResolved(locale: LocaleSummary): ResolvedLocale {
  return { id: locale.id, code: locale.code, urlPrefix: locale.urlPrefix ?? '' }
}

/** resolve the content locale for an incoming request (never throws) */
export async function resolveLocale(path: string, acceptLanguage?: string): Promise<ResolvedLocale> {
  const locales = await activeLocales()
  if (locales.length === 0) return DEGRADED_DEFAULT
  const byPath = matchLocaleByPathPrefix(path, locales)
  if (byPath) return toResolved(byPath)
  const byHeader = matchLocaleFromAcceptLanguage(acceptLanguage, locales)
  if (byHeader) return toResolved(byHeader)
  const fallback = defaultLocale(locales)
  return fallback ? toResolved(fallback) : DEGRADED_DEFAULT
}

/** every public cache key must be locale-scoped (architecture §10) */
export function withLocaleKey(key: string, locale: ResolvedLocale | string): string {
  const code = typeof locale === 'string' ? locale : locale.code
  return `${key}:${code}`
}
