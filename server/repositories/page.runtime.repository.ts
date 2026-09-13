import * as mysql from './page.repository'
import * as postgres from './page.postgres.repository'
import { createDomainRepositoryContext } from './domain-context'

const implementation = (createDomainRepositoryContext({ driver: process.env.DB_DRIVER }).isPostgres ? postgres : mysql) as typeof mysql

export type { PageRecord, PageTranslationRow, PageListQuery, PublishedPage } from './page.repository'
export const listPages = implementation.listPages
export const findPageRow = implementation.findPageRow
export const getPage = implementation.getPage
export const insertPage = implementation.insertPage
export const updatePageRow = implementation.updatePageRow
export const deletePageRow = implementation.deletePageRow
export const findPublishedPageByAlias = implementation.findPublishedPageByAlias
export const listPublishedPages = implementation.listPublishedPages
export const findPublishedPageAliasById = implementation.findPublishedPageAliasById
export const findPageByAlias = implementation.findPageByAlias
export const countPagesByStatus = implementation.countPagesByStatus
