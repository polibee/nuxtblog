import { beforeEach, describe, expect, it, vi } from 'vitest'

const isDomainDbReady = vi.fn()
const findNavigationByLocation = vi.fn()
const listLocales = vi.fn()
const findVariant = vi.fn()
const listVariantItems = vi.fn()
const findPublishedPostAliasById = vi.fn()
const findPublishedPageAliasById = vi.fn()
const findTaxonomyRow = vi.fn()
const findTaxonomyAliasById = vi.fn()

vi.mock('../../server/repositories/domain-status', () => ({ isDomainDbReady }))
vi.mock('../../server/repositories/locale.runtime.repository', () => ({ listLocales }))
vi.mock('../../server/repositories/navigation.runtime.repository', () => ({
  copyVariantItems: vi.fn(),
  deleteVariant: vi.fn(),
  findNavigationByLocation,
  findNavigationRow: vi.fn(),
  findVariant,
  findVariantById: vi.fn(),
  insertNavigation: vi.fn(),
  insertVariant: vi.fn(),
  listNavigations: vi.fn(),
  listVariantItems,
  replaceVariantItems: vi.fn(),
  updateNavigationMeta: vi.fn(),
  updateVariantStatus: vi.fn()
}))
vi.mock('../../server/repositories/page.runtime.repository', () => ({
  findPageRow: vi.fn(),
  findPublishedPageAliasById
}))
vi.mock('../../server/repositories/post.runtime.repository', () => ({
  findPostRow: vi.fn(),
  findPublishedPostAliasById
}))
vi.mock('../../server/repositories/taxonomy.runtime.repository', () => ({
  findTaxonomyAliasById,
  findTaxonomyRow
}))
vi.mock('../../server/utils/navigationCache', () => ({
  invalidateNavigationCache: vi.fn()
}))

const { resolveNavigation } = await import('../../server/modules/navigation/navigation.service')

describe('public navigation locale resolution', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    isDomainDbReady.mockReturnValue(true)
    ;(globalThis as typeof globalThis & { getKV: () => { get: () => Promise<null>, set: () => Promise<void> } }).getKV = () => ({
      get: async () => null,
      set: async () => undefined
    })
    findNavigationByLocation.mockResolvedValue({ id: 4, enabled: true })
    listLocales.mockResolvedValue([
      { id: 1, code: 'zh-CN', isDefault: true },
      { id: 2, code: 'en', isDefault: false }
    ])
    findVariant.mockResolvedValue({ id: 8, status: 'published' })
    findPublishedPostAliasById.mockResolvedValue('hello-world')
    findPublishedPageAliasById.mockResolvedValue(null)
    findTaxonomyRow.mockResolvedValue(null)
    findTaxonomyAliasById.mockResolvedValue(null)
  })

  it('uses the requested locale target and controlled English fallback in the public chain', async () => {
    listVariantItems.mockResolvedValue([
      {
        id: 10,
        parentId: null,
        type: 'post',
        targetEntityType: 'post',
        targetEntityId: 22,
        label: '',
        customUrl: null,
        titleAttribute: null,
        rel: null,
        nofollow: false,
        enabled: true,
        sortOrder: 0
      },
      {
        id: 11,
        parentId: null,
        type: 'group',
        label: '',
        alias: 'updates',
        titleAttribute: null,
        enabled: true,
        sortOrder: 1
      }
    ])

    const result = await resolveNavigation('header', 'en')

    expect(findVariant).toHaveBeenCalledWith(4, 2)
    expect(findPublishedPostAliasById).toHaveBeenCalledWith(22, 2)
    expect(result.items).toEqual([
      expect.objectContaining({ label: 'Hello-world', url: '/posts/hello-world' }),
      expect.objectContaining({ label: 'Updates', url: '#' })
    ])
  })

  it('uses the internal custom URL alias when an English label is unavailable', async () => {
    findVariant.mockImplementation(async (_navigationId: number, localeId: number) =>
      localeId === 2 ? undefined : { id: 8, status: 'published' })
    listVariantItems.mockResolvedValue([
      {
        id: 12,
        parentId: null,
        type: 'custom',
        targetEntityType: null,
        targetEntityId: null,
        label: '关于我们',
        customUrl: '/about',
        titleAttribute: null,
        rel: null,
        nofollow: false,
        enabled: true,
        sortOrder: 0
      },
      {
        id: 13,
        parentId: null,
        type: 'custom',
        targetEntityType: null,
        targetEntityId: null,
        label: '首页',
        customUrl: '/',
        titleAttribute: null,
        rel: null,
        nofollow: false,
        enabled: true,
        sortOrder: 1
      }
    ])

    const result = await resolveNavigation('header', 'en')

    expect(result.items.map(item => item.label)).toEqual(['About', 'Home'])
  })
})
