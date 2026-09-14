import { afterEach, describe, expect, it, vi } from 'vitest'

const getSettingValue = vi.fn()

vi.mock('../../server/modules/settings/settings.runtime.service', () => ({ getSettingValue }))

describe('Turnstile verification', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    getSettingValue.mockReset()
  })

  it('returns false when Cloudflare rejects the token', async () => {
    getSettingValue.mockImplementation(async (key: string) => {
      if (key === 'comments.turnstile_secret_key') return 'fixture-secret'
      return ''
    })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ 'success': false, 'error-codes': ['invalid-input-response'] }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      })
    ))

    const { verifyTurnstile } = await import('../../server/utils/turnstile')
    await expect(verifyTurnstile('fixture-token', '203.0.113.7')).resolves.toBe(false)
  })
})
