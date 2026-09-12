/* =============================================================
 * Fixed-window in-memory rate limiter (single node). Production
 * multi-instance deployments should swap the backing store for
 * Redis while keeping this contract.
 * ============================================================= */

interface Window {
  count: number
  resetAt: number
}

const windows = new Map<string, Window>()

export interface RateLimitOptions {
  /** unique bucket name, e.g. "login" */
  key: string
  /** identities combined into the bucket key (ip, email, ...) */
  identity: string
  limit: number
  windowMs: number
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  retryAfterSeconds: number
}

export function hitRateLimit(options: RateLimitOptions): RateLimitResult {
  const bucket = `${options.key}:${options.identity}`
  const now = Date.now()
  const current = windows.get(bucket)

  if (!current || current.resetAt <= now) {
    windows.set(bucket, { count: 1, resetAt: now + options.windowMs })
    return { allowed: true, remaining: options.limit - 1, retryAfterSeconds: 0 }
  }

  current.count += 1
  if (current.count > options.limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(Math.ceil((current.resetAt - now) / 1000), 1)
    }
  }
  return { allowed: true, remaining: options.limit - current.count, retryAfterSeconds: 0 }
}

/** drop expired windows; call opportunistically from auth endpoints */
export function pruneRateLimits(): void {
  const now = Date.now()
  for (const [bucket, window] of windows) {
    if (window.resetAt <= now) windows.delete(bucket)
  }
}

export function clearRateLimits(key?: string): void {
  if (!key) {
    windows.clear()
    return
  }
  for (const bucket of windows.keys()) {
    if (bucket.startsWith(`${key}:`)) windows.delete(bucket)
  }
}
