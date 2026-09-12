import { describe, expect, it } from 'vitest'
import { coerceSettingValue } from '../../server/modules/settings/settings.service'

describe('coerceSettingValue', () => {
  it('parses boolean values', () => {
    expect(coerceSettingValue('true', 'boolean')).toBe(true)
    expect(coerceSettingValue('1', 'boolean')).toBe(true)
    expect(coerceSettingValue('false', 'boolean')).toBe(false)
    expect(coerceSettingValue('', 'boolean')).toBe(false)
  })

  it('parses numeric values and keeps non-numeric raw', () => {
    expect(coerceSettingValue('12', 'number')).toBe(12)
    expect(coerceSettingValue('3.5', 'number')).toBe(3.5)
    expect(coerceSettingValue('auto', 'number')).toBe('auto')
  })

  it('returns raw strings for text-ish types', () => {
    expect(coerceSettingValue('hello', 'string')).toBe('hello')
    expect(coerceSettingValue('<p>html</p>', 'text')).toBe('<p>html</p>')
    expect(coerceSettingValue('{"a":1}', 'json')).toBe('{"a":1}')
    expect(coerceSettingValue('s3cret', 'secret')).toBe('s3cret')
  })
})
