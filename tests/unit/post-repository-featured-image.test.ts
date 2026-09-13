import { beforeEach, describe, expect, it, vi } from 'vitest'
import { findPublishedByAlias, listPublished, updatePostRow } from '../../server/repositories/post.repository'
import { findPublishedByAlias as findPublishedByAliasPostgres } from '../../server/repositories/post.postgres.repository'

const publishedRows: Array<Record<string, unknown>> = [{
  postId: 7,
  title: 'Legacy cover',
  alias: 'legacy-cover',
  excerpt: '',
  content: '<p>Content</p>',
  seoTitle: '',
  seoDescription: '',
  noindex: false,
  publishedAt: new Date('2026-09-13T00:00:00.000Z'),
  featuredMediaId: 22,
  translationFeaturedId: 11,
  accessType: 'public',
  postsPaidPriceMinor: null,
  postsPaidCurrency: null,
  authorName: 'Author',
  commentStatus: 'closed'
}]

let legacyRows: Array<{ localeId: number, featuredImageId: number | null }> = []
let insertedTranslations: Array<Record<string, unknown>> = []
let queryRows: unknown[] = publishedRows

const postgresRows = [{ ...publishedRows[0], translationFeaturedId: null }]
let postgresQueryRows: unknown[] = postgresRows

const dbStub = {
  select: vi.fn(() => {
    const chain = {
      from: vi.fn(() => chain),
      innerJoin: vi.fn(() => chain),
      where: vi.fn(() => chain),
      orderBy: vi.fn(() => chain),
      limit: vi.fn(async () => queryRows),
      then: (resolve: (value: unknown) => unknown) => Promise.resolve(resolve(legacyRows))
    }
    return chain
  }),
  delete: vi.fn(() => ({
    where: vi.fn(async () => undefined)
  })),
  insert: vi.fn(() => ({
    values: vi.fn(async (values: Array<Record<string, unknown>>) => {
      insertedTranslations = values
    })
  })),
  transaction: vi.fn(async (callback: (tx: typeof dbStub) => Promise<unknown>) => callback(dbStub))
}

const postgresDbStub = {
  select: vi.fn(() => {
    const chain = {
      from: vi.fn(() => chain),
      innerJoin: vi.fn(() => chain),
      where: vi.fn(() => chain),
      limit: vi.fn(async () => postgresQueryRows)
    }
    return chain
  })
}

vi.mock('../../server/repositories/db.server', () => ({
  getDb: vi.fn(() => dbStub)
}))

vi.mock('../../server/repositories/db-postgres.server', () => ({
  getPostgresDb: vi.fn(() => postgresDbStub)
}))

describe('MySQL post featured image compatibility', () => {
  beforeEach(() => {
    legacyRows = [{ localeId: 1, featuredImageId: 11 }]
    insertedTranslations = []
    queryRows = publishedRows
    postgresQueryRows = postgresRows
    vi.clearAllMocks()
  })

  it('retains the legacy translation featured image during replacement', async () => {
    await updatePostRow(7, {}, [{
      localeId: 1,
      title: 'Updated title',
      excerpt: '',
      content: '<p>Updated</p>',
      seoTitle: '',
      seoDescription: '',
      canonicalUrl: null,
      noindex: false
    }])

    expect(insertedTranslations).toEqual([expect.objectContaining({
      postId: 7,
      localeId: 1,
      featuredImageId: 11
    })])
  })

  it('prefers the legacy translation cover before the post cover', async () => {
    const result = await listPublished(1)

    expect(result.items[0]?.coverMediaId).toBe(11)
  })

  it('falls back to the post cover when the legacy translation cover is null', async () => {
    publishedRows[0]!.translationFeaturedId = null

    const result = await listPublished(1)

    expect(result.items[0]?.coverMediaId).toBe(22)
  })

  it('uses the same fallback for the MySQL alias lookup', async () => {
    publishedRows[0]!.translationFeaturedId = null

    const result = await findPublishedByAlias(1, 'legacy-cover')

    expect(result?.coverMediaId).toBe(22)
  })

  it('uses the same fallback for the PostgreSQL alias lookup', async () => {
    const result = await findPublishedByAliasPostgres(1, 'legacy-cover')

    expect(result?.coverMediaId).toBe(22)
  })
})
