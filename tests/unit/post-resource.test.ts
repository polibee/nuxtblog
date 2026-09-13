import type { FieldNode, SchemaNode } from '../../app/admin/core/types'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

function sectionFields(node: SchemaNode): FieldNode[] {
  if (node.type === 'field') return [node]
  return node.children.flatMap(sectionFields)
}

describe('post resource', () => {
  beforeAll(() => {
    const field = (name: string, label: string, options: Record<string, unknown> = {}) => ({
      type: 'field' as const,
      kind: 'text' as const,
      name,
      label,
      ...options
    })
    vi.stubGlobal('defineResource', <T>(resource: T) => resource)
    vi.stubGlobal('section', (title: string, children: SchemaNode[]) => ({ type: 'section' as const, title, children }))
    vi.stubGlobal('grid', (columns: 1 | 2 | 3 | 4, children: SchemaNode[]) => ({ type: 'grid' as const, columns, children }))
    vi.stubGlobal('textInput', field)
    vi.stubGlobal('textarea', field)
    vi.stubGlobal('richTextInput', field)
    vi.stubGlobal('switchInput', field)
    vi.stubGlobal('dateInput', field)
    vi.stubGlobal('selectInput', field)
    vi.stubGlobal('numberInput', field)
    vi.stubGlobal('mediaPicker', field)
    vi.stubGlobal('defineAction', <T>(action: T) => action)
  })

  afterAll(() => vi.unstubAllGlobals())

  it('post resource uses the top-level featuredMediaId field and translated hint', async () => {
    const { default: createPostResource } = await import('../../app/modules/posts/admin/PostResource')
    const translations: Record<string, string> = {
      'res.posts.field.featuredImage': '特色图片',
      'res.posts.help.featuredImage': '推荐尺寸 1600×1000，比例 16:10'
    }
    const translator = vi.fn((key: string) => translations[key] ?? `missing:${key}`)
    const resource = createPostResource(translator)
    const fields = resource.form!().flatMap(sectionFields)
    const featuredMedia = fields.find(field => field.name === 'featuredMediaId')

    expect(featuredMedia).toMatchObject({
      name: 'featuredMediaId',
      label: '特色图片',
      helpText: '推荐尺寸 1600×1000，比例 16:10'
    })
    expect(translator).toHaveBeenCalledWith('res.posts.help.featuredImage')
  })
})
