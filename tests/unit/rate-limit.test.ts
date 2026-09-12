import { afterEach, describe, expect, it } from 'vitest'
import { clearRateLimits, hitRateLimit, pruneRateLimits } from '../../server/utils/rate-limit'

afterEach(() => clearRateLimits())

describe('hitRateLimit', () => {
  it('allows up to the limit then blocks', () => {
    for (let i = 0; i < 5; i++) {
      expect(hitRateLimit({ key: 'login', identity: 'u1', limit: 5, windowMs: 60_000 }).allowed).toBe(true)
    }
    const blocked = hitRateLimit({ key: 'login', identity: 'u1', limit: 5, windowMs: 60_000 })
    expect(blocked.allowed).toBe(false)
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0)
  })

  it('isolates identities', () => {
    hitRateLimit({ key: 'login', identity: 'a', limit: 1, windowMs: 60_000 })
    expect(hitRateLimit({ key: 'login', identity: 'b', limit: 1, windowMs: 60_000 }).allowed).toBe(true)
    expect(hitRateLimit({ key: 'login', identity: 'a', limit: 1, windowMs: 60_000 }).allowed).toBe(false)
  })

  it('reports remaining quota', () => {
    const first = hitRateLimit({ key: 'quota', identity: 'x', limit: 3, windowMs: 60_000 })
    expect(first.remaining).toBe(2)
  })
})

describe('pruneRateLimits', () => {
  it('drops expired windows without touching active ones', () => {
    hitRateLimit({ key: 'keep', identity: 'x', limit: 1, windowMs: 60_000 })
    hitRateLimit({ key: 'drop', identity: 'y', limit: 1, windowMs: 1 })
    await_new_tick()
    pruneRateLimits()
    expect(hitRateLimit({ key: 'drop', identity: 'y', limit: 1, windowMs: 60_000 }).allowed).toBe(true)
    expect(hitRateLimit({ key: 'keep', identity: 'x', limit: 1, windowMs: 60_000 }).allowed).toBe(false)
  })
})

function await_new_tick(): void {
  // 1ms windows expire on their own; give the clock a beat to move
  const start = Date.now()
  while (Date.now() === start) { /* busy-wait one ms */ }
}
