import { demoAccountEmail, isDemoAccountEnabled } from './demo-account'

export interface PublicLoginCredential {
  kind: 'admin' | 'demo'
  email: string
  password: string
  readOnly?: boolean
}

function isPublicFlag(value: string | undefined): boolean {
  return value === 'true'
}

/** Return only credentials explicitly opted in for the public login page. */
export function getPublicLoginCredentials(): PublicLoginCredential[] {
  const credentials: PublicLoginCredential[] = []

  if (isPublicFlag(process.env.BLOG_ADMIN_PUBLIC)) {
    credentials.push({
      kind: 'admin',
      email: process.env.BLOG_ADMIN_EMAIL ?? 'admin@example.com',
      password: process.env.BLOG_ADMIN_PASSWORD ?? 'admin123456'
    })
  }

  if (isDemoAccountEnabled() && isPublicFlag(process.env.DEMO_ACCOUNT_PUBLIC)) {
    credentials.push({
      kind: 'demo',
      email: demoAccountEmail(),
      password: process.env.DEMO_ACCOUNT_PASSWORD ?? 'demo123456',
      readOnly: true
    })
  }

  return credentials
}
