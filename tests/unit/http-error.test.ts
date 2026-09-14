import { describe, expect, it } from 'vitest'
import { getErrorStatusCode, isNotFoundError } from '#shared/utils/http-error'

describe('HTTP error status helpers', () => {
  it('reads Nuxt fetch error statusCode and nested statusCode', () => {
    expect(getErrorStatusCode({ statusCode: 409 })).toBe(409)
    expect(getErrorStatusCode({ data: { statusCode: 404 } })).toBe(404)
  })

  it('only treats an actual 404 as a missing resource', () => {
    expect(isNotFoundError({ status: 404 })).toBe(true)
    expect(isNotFoundError({ status: 500 })).toBe(false)
    expect(isNotFoundError(new Error('database unavailable'))).toBe(false)
  })
})
