/* Shared helpers for gateway drivers: money formatting and JSON HTTP. */
import { createHmac, timingSafeEqual } from 'node:crypto'

const ZERO_DECIMAL_CURRENCIES = new Set(['JPY', 'KRW', 'VND', 'CLP'])

export function formatAmount(amountMinor: number, currency: string): string {
  const decimals = ZERO_DECIMAL_CURRENCIES.has(currency.toUpperCase()) ? 0 : 2
  return (amountMinor / 10 ** decimals).toFixed(decimals)
}

export function parseAmountToMinor(value: string | number, currency: string): number {
  const decimals = ZERO_DECIMAL_CURRENCIES.has(currency.toUpperCase()) ? 0 : 2
  return Math.round(Number(value) * 10 ** decimals)
}

export interface JsonOptions {
  method: 'GET' | 'POST'
  url: string
  headers?: Record<string, string>
  body?: unknown
  timeoutMs?: number
}

/** JSON fetch with normalized errors: thrown Error carries statusCode. */
export async function requestJson<T>(options: JsonOptions): Promise<T> {
  let response: Response
  try {
    response = await fetch(options.url, {
      method: options.method,
      headers: options.headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: AbortSignal.timeout(options.timeoutMs ?? 20_000)
    })
  } catch (error) {
    if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
      throw Object.assign(new Error(`Request to ${options.url} timed out`), { statusCode: 504 })
    }
    throw error
  }
  const text = await response.text()
  let data: unknown = {}
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = { raw: text }
    }
  }
  if (!response.ok) {
    const detail = (data as { message?: string, detail?: string, error?: string }).message
      ?? (data as { detail?: string }).detail
      ?? (data as { error?: string }).error
      ?? `HTTP ${response.status}`
    throw Object.assign(new Error(`${options.url} failed: ${detail}`), { statusCode: response.status })
  }
  return data as T
}

export function hmacHex(algorithm: 'sha256' | 'sha512', secret: string, message: string): string {
  return createHmac(algorithm, secret).update(message).digest('hex')
}

export function safeEqualHex(a: string, b: string): boolean {
  if (!a || !b) return false
  const bufA = Buffer.from(a.toLowerCase(), 'utf8')
  const bufB = Buffer.from(b.toLowerCase(), 'utf8')
  if (bufA.length !== bufB.length) return false
  return timingSafeEqual(bufA, bufB)
}
