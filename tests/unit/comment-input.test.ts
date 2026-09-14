import { describe, expect, it } from 'vitest'
import { commentInputSchema } from '#shared/schemas/comment'

describe('comment input', () => {
  const base = {
    name: 'Guest',
    email: 'guest@example.com',
    content: 'A useful comment',
    turnstileToken: 'fixture-token'
  }

  it('accepts an optional HTTP(S) guest website', () => {
    const result = commentInputSchema.safeParse({ ...base, website: 'https://example.com/about' })
    expect(result.success).toBe(true)
  })

  it.each([
    'javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'http://localhost/profile',
    'http://127.0.0.1/profile',
    'http://192.168.1.20/profile',
    'http://[::1]/profile'
  ])('rejects unsafe guest website %s', (website) => {
    expect(commentInputSchema.safeParse({ ...base, website }).success).toBe(false)
  })
})
