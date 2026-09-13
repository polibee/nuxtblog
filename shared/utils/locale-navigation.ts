interface PathLocale {
  code: string
  urlPrefix: string | null | undefined
}

const PUBLIC_ROUTE_SEGMENTS = new Set(['posts', 'pages', 'profile', 'category', 'tag', 'archive', 'categories', 'tags', 'search', 'friends', 'store', 'membership', 'account'])

/** Build a public URL for a target content locale while preserving query/hash. */
export function localizedPath(path: string, target: PathLocale, defaultCode: string): string {
  if (/^(?:[a-z][a-z\d+.-]*:|\/\/)/iu.test(path)) return path
  const parsed = new URL(path, 'http://nuxtblog.local')
  parsed.searchParams.delete('locale')
  const pathname = parsed.pathname || '/'
  const segments = pathname.split('/').filter(Boolean)
  const first = segments[0]
  const looksLikeLocale = Boolean(first && !PUBLIC_ROUTE_SEGMENTS.has(first.toLowerCase())
    && /^[a-z]{2,3}(?:-[A-Z0-9]{2,8})?$/u.test(first))
  if (first && (first === target.urlPrefix || looksLikeLocale)) segments.shift()
  const cleanPath = `/${segments.join('/')}`.replace(/\/$/u, '') || '/'
  const prefix = target.code === defaultCode ? '' : (target.urlPrefix ? `/${target.urlPrefix}` : '')
  const routePath = cleanPath === '/' && prefix ? prefix : `${prefix}${cleanPath}`
  return `${routePath}${parsed.search}${parsed.hash}`
}
