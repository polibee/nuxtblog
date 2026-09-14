import { getPublicLoginCredentials } from '../../utils/login-credentials'

/** Public demo login hint; expose it only when explicitly enabled. */
export default defineEventHandler(() => {
  const credential = getPublicLoginCredentials().find(item => item.kind === 'demo')
  if (!credential) {
    throw createError({ statusCode: 404, statusMessage: 'Not found' })
  }
  return credential
})
