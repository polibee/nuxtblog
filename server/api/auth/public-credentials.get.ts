import { getPublicLoginCredentials } from '../../utils/login-credentials'

/** Public login-page hints. Empty by default; secrets are never returned otherwise. */
export default defineEventHandler(() => ({
  credentials: getPublicLoginCredentials()
}))
