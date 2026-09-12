import { describe, expect, it } from 'vitest'
import { isSafeStorageKey, sanitizeMediaFilename } from '../../server/modules/media/media.service'

describe('sanitizeMediaFilename', () => {
  it('strips path separators and control characters', () => {
    expect(sanitizeMediaFilename('../../etc/passwd')).toBe('..-..-etc-passwd')
    expect(sanitizeMediaFilename('a/b\\c.png')).toBe('a-b-c.png')
    expect(sanitizeMediaFilename('bad\x00name.txt')).toBe('badname.txt')
  })

  it('keeps unicode names and truncates to 255 chars', () => {
    expect(sanitizeMediaFilename('截图 2026.png')).toBe('截图 2026.png')
    expect(sanitizeMediaFilename('x'.repeat(300)).length).toBe(255)
  })

  it('falls back to "file" for empty names', () => {
    expect(sanitizeMediaFilename('')).toBe('file')
    expect(sanitizeMediaFilename('///')).toBe('file')
  })
})

describe('isSafeStorageKey', () => {
  it('accepts generated timestamp-uuid keys', () => {
    expect(isSafeStorageKey('1788942649027-21b56c16-5ba2-44d9-b676-9ed508231de0')).toBe(true)
  })

  it('rejects traversal and malformed keys', () => {
    expect(isSafeStorageKey('../../etc/passwd')).toBe(false)
    expect(isSafeStorageKey('')).toBe(false)
    expect(isSafeStorageKey('short')).toBe(false)
    expect(isSafeStorageKey('1788942649027-21b56c16-5ba2-44d9-b676-9ed508231de0/extra')).toBe(false)
  })
})
