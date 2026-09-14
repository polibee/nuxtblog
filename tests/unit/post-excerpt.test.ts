import { describe, expect, it } from 'vitest'
import { excerptFromContent, resolvePostExcerpt } from '../../shared/utils/post-excerpt'

describe('post card excerpts', () => {
  it('uses the first meaningful paragraph and strips rich text', () => {
    expect(excerptFromContent('<h2>标题</h2><p>第一段&nbsp;内容<strong>很重要</strong>。</p><p>第二段。</p>'))
      .toBe('第一段 内容很重要。')
  })

  it('truncates long paragraphs and preserves an explicitly authored excerpt', () => {
    expect(excerptFromContent('<p>abcdefghij</p>', 5)).toBe('abcde…')
    expect(resolvePostExcerpt('手工摘要', '<p>正文</p>')).toBe('手工摘要')
    expect(resolvePostExcerpt('', '<p>正文</p>')).toBe('正文')
  })
})
