import { isDomainDbReady } from '../repositories/domain-status'
import { findRedirect } from '../repositories/alias.runtime.repository'

/**
 * Nitro middleware: serves 301/308 redirects recorded when an entity
 * alias changes (alias unification doc §3.3). Old paths never render
 * content directly.
 */
export default defineEventHandler(async (event) => {
  if (event.method !== 'GET' && event.method !== 'HEAD') return
  const path = event.path.split('?')[0]
  if (path.startsWith('/admin') || path.startsWith('/api')) return
  if (!isDomainDbReady()) return

  try {
    const redirect = await findRedirect(path)
    if (!redirect) return
    setResponseStatus(event, redirect.statusCode)
    setResponseHeader(event, 'Location', redirect.newPath)
    setResponseHeader(event, 'Cache-Control', 'public, max-age=86400')
    // terminate: old paths must never fall through to rendering
    return ''
  } catch {
    // redirect lookup must never break rendering
  }
})
