import { describe, expect, it } from 'vitest'
import { gravatarHash, parseCommentMetadata } from '../../server/utils/comment-metadata'

describe('comment metadata', () => {
  it('normalizes a Chrome Windows desktop user agent', () => {
    expect(parseCommentMetadata(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36'
    )).toEqual({
      browserName: 'Chrome',
      browserVersion: '140.0.0.0',
      osName: 'Windows',
      osVersion: '10',
      deviceType: 'desktop'
    })
  })

  it('normalizes an iPhone Safari mobile user agent', () => {
    expect(parseCommentMetadata(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1'
    )).toEqual({
      browserName: 'Safari',
      browserVersion: '18.6',
      osName: 'iOS',
      osVersion: '18.6',
      deviceType: 'mobile'
    })
  })

  it('returns null fields for an unknown user agent', () => {
    expect(parseCommentMetadata('')).toEqual({
      browserName: null,
      browserVersion: null,
      osName: null,
      osVersion: null,
      deviceType: 'unknown'
    })
  })

  it('hashes a trimmed lowercase email for Gravatar', () => {
    expect(gravatarHash('  User@Example.COM ')).toBe('b58996c504c5638798eb6b511e6f49af')
  })
})
