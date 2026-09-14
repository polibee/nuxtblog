import { describe, expect, it } from 'vitest'
import { createProjectPlaceholder } from '../../shared/utils/project-placeholder'

describe('createProjectPlaceholder', () => {
  it('creates a stable two-letter monogram for a single-word project', () => {
    expect(createProjectPlaceholder('NuxtBlog')).toMatchObject({ monogram: 'NU', label: 'Project' })
  })

  it('uses the first letters of a multi-word project name', () => {
    expect(createProjectPlaceholder('Blog Framework')).toMatchObject({ monogram: 'BF' })
  })
})
