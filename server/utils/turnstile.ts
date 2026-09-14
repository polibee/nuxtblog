import { getSettingValue } from '../modules/settings/settings.runtime.service'

const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'
const TURNSTILE_TIMEOUT_MS = 5_000

export async function verifyTurnstile(token: string, ip: string): Promise<boolean> {
  const secret = String(await getSettingValue('comments.turnstile_secret_key', process.env.TURNSTILE_SECRET_KEY ?? ''))
  if (!secret || !token) return false

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), TURNSTILE_TIMEOUT_MS)
  try {
    const body = new URLSearchParams({ secret, response: token })
    if (ip && ip !== 'unknown') body.set('remoteip', ip)
    const response = await fetch(TURNSTILE_VERIFY_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body,
      signal: controller.signal
    })
    if (!response.ok) return false
    const result = await response.json() as { success?: boolean }
    return result.success === true
  } catch {
    return false
  } finally {
    clearTimeout(timeout)
  }
}
