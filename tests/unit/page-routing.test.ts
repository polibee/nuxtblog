import { describe, expect, it } from 'vitest'
import { contentUrl } from '../../server/utils/contentUrl'

describe('canonical managed page routes', () => {
  it('uses the root alias namespace for pages', () => {
    expect(contentUrl('page', 'about')).toBe('/about')
    expect(contentUrl('post', 'hello')).toBe('/posts/hello')
  })
})
