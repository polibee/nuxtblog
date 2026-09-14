import { getSessionUser } from '../utils/auth'
import { isDemoAccountUser } from '../utils/demo-account'

/** Protect every API mutation for the public, read-only demo account. */
export default defineEventHandler(async (event) => {
  const method = event.node.req.method?.toUpperCase() ?? 'GET'
  const path = event.path ?? ''
  if (!path.startsWith('/api/') || ['GET', 'HEAD', 'OPTIONS'].includes(method)) return
  if (path === '/api/auth/login' || path === '/api/auth/logout') return
  const user = await getSessionUser(event)
  if (isDemoAccountUser(user)) {
    throw createError({ statusCode: 403, statusMessage: 'Demo account is read-only' })
  }
})
