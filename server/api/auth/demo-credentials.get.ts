import { demoAccountEmail, isDemoAccountEnabled } from '../../utils/demo-account'

/** Public demo login hint; expose it only when explicitly enabled. */
export default defineEventHandler(() => {
  if (!isDemoAccountEnabled() || process.env.DEMO_ACCOUNT_PUBLIC !== 'true') {
    throw createError({ statusCode: 404, statusMessage: 'Not found' })
  }
  return {
    email: demoAccountEmail(),
    password: process.env.DEMO_ACCOUNT_PASSWORD ?? 'demo123456',
    readOnly: true
  }
})
