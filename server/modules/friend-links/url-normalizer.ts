/* P37 URL normalization (docs/友链.txt §23/46): hostname-based identity
   for friend links — https://example.com, http://example.com/ and
   https://www.example.com/ are the same site, but example.com.evil.com
   must never compare equal. */

export function normalizeDomain(input: string): string {
  const raw = input.trim().toLowerCase()
  if (!raw) return ''
  try {
    const url = new URL(raw.includes('://') ? raw : `https://${raw}`)
    return stripWww(url.hostname)
  } catch {
    return ''
  }
}

export function normalizeUrl(input: string): string {
  const raw = input.trim()
  if (!raw) return ''
  try {
    const url = new URL(raw.includes('://') ? raw : `https://${raw}`)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return ''
    /* root path only — /friends is a different page, keep pathname when
       the submitter pointed at a deep link? §46: normalized_url is for
       SITE identity → scheme://host/ */
    return `${url.protocol}//${url.hostname}${url.port ? `:${url.port}` : ''}/`
  } catch {
    return ''
  }
}

function stripWww(hostname: string): string {
  return hostname.startsWith('www.') ? hostname.slice(4) : hostname
}

/** same-site comparison (www-insensitive, suffix-safe) */
export function sameDomain(a: string, b: string): boolean {
  const da = normalizeDomain(a)
  const db = normalizeDomain(b)
  return da !== '' && da === db
}

export function extractDomain(input: string): string {
  return normalizeDomain(input)
}
