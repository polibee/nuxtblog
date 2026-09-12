import type { PageRecord, PageTranslationRow } from './page.repository'
import type { PostRecord, PostTranslationRow, PublishedTranslation } from './post.repository'

export interface PageRepositoryContract {
  listPages(query: { q?: string, status?: string, page?: number, perPage?: number }): Promise<{ items: PageRecord[], total: number, page: number, perPage: number, totalPages: number }>
  getPage(id: number): Promise<PageRecord | undefined>
  insertPage(entity: Record<string, unknown>, translations: PageTranslationRow[]): Promise<number>
  updatePageRow(id: number, patch: Record<string, unknown>, translations?: PageTranslationRow[]): Promise<void>
}

export interface PostRepositoryContract {
  listPosts(query: { q?: string, status?: string, page?: number, perPage?: number }): Promise<{ items: PostRecord[], total: number, page: number, perPage: number, totalPages: number }>
  getPost(id: number): Promise<PostRecord | undefined>
  listPublished(localeId: number, options?: { page?: number, perPage?: number, q?: string }): Promise<{ items: PublishedTranslation[], total: number }>
  findPublishedByAlias(localeId: number, alias: string): Promise<PublishedTranslation | undefined>
  insertPost(entity: Record<string, unknown>, translations: PostTranslationRow[]): Promise<number>
  updatePostRow(id: number, patch: Record<string, unknown>, translations?: PostTranslationRow[]): Promise<void>
}

export interface ProfileRepositoryContract {
  getProfile(localeId: number): Promise<Record<string, unknown> | undefined>
  upsertProfile(localeId: number, input: Record<string, unknown>): Promise<void>
}

export interface AliasRepositoryContract {
  resolve(path: string): Promise<{ redirect: true, statusCode: 301, location: string } | { redirect: false }>
  recordChange(input: { entityType: string, entityId: number, localeId?: number, oldPath: string, newPath: string }): Promise<void>
}

export interface LocalizedSettingsRepositoryContract {
  get(key: string, localeId: number): Promise<string | undefined>
  upsert(key: string, localeId: number, value: string): Promise<void>
}
