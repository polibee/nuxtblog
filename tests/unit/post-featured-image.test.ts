import { describe, expect, it } from 'vitest'
import { postInputSchema } from '../../shared/schemas/post'

describe('post featured image input', () => {
  it('accepts top-level featuredMediaId and explicit null', () => {
    expect(postInputSchema.parse({ featuredMediaId: 12 }).featuredMediaId).toBe(12)
    expect(postInputSchema.parse({ featuredMediaId: null }).featuredMediaId).toBeNull()
  })

  it('does not expose translation featuredImageId as a top-level field', () => {
    expect(() => postInputSchema.parse({ featuredImageId: 12 })).toThrow()
  })

  it('does not accept translation featuredImageId as a write entry point', () => {
    expect(() => postInputSchema.parse({
      translations: {
        'zh-CN': {
          title: 'Featured image contract',
          featuredImageId: 12
        }
      }
    })).toThrow()
  })

  it('continues stripping unrelated unknown translation fields', () => {
    const parsed = postInputSchema.parse({
      translations: {
        'zh-CN': {
          title: 'Featured image contract',
          unrelatedLegacyField: 'ignored'
        }
      }
    })

    expect(parsed.translations?.['zh-CN']).not.toHaveProperty('unrelatedLegacyField')
  })
})
