import { describe, expect, it } from 'vitest'

import enAdmin from '../../app/i18n/locales/en/admin'
import enCommon from '../../app/i18n/locales/en/common'
import zhAdmin from '../../app/i18n/locales/zh-CN/admin'
import zhCommon from '../../app/i18n/locales/zh-CN/common'

type LocaleObject = Record<string, unknown>

function flattenKeys(value: LocaleObject, prefix = ''): string[] {
  return Object.entries(value).flatMap(([key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key
    if (child && typeof child === 'object' && !Array.isArray(child)) {
      return flattenKeys(child as LocaleObject, path)
    }
    return [path]
  }).sort()
}

const intentionallyServerOnlyKeys = new Set<string>()

function comparableKeys(value: LocaleObject): string[] {
  return flattenKeys(value).filter(key => !intentionallyServerOnlyKeys.has(key))
}

describe('modular locale bundles', () => {
  it('keeps zh-CN and en key sets aligned', () => {
    expect(comparableKeys(zhCommon)).toEqual(comparableKeys(enCommon))
    expect(comparableKeys(zhAdmin)).toEqual(comparableKeys(enAdmin))
  })
})
