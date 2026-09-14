import type { AuthUser } from '#shared/types/api'

export function isDemoAccountEnabled(): boolean {
  return process.env.DEMO_ACCOUNT_ENABLED === 'true'
}

export function demoAccountEmail(): string {
  return (process.env.DEMO_ACCOUNT_EMAIL ?? 'demo@example.com').trim().toLowerCase()
}

export function isDemoAccountUser(user: Pick<AuthUser, 'email'> | undefined | null): boolean {
  return isDemoAccountEnabled() && user?.email.trim().toLowerCase() === demoAccountEmail()
}
