import * as mysql from './media.repository'
import * as postgres from './media.postgres.repository'
import { createDomainRepositoryContext } from './domain-context'

const implementation = (createDomainRepositoryContext({ driver: process.env.DB_DRIVER }).isPostgres ? postgres : mysql) as typeof mysql
export type { MediaRecord, MediaTranslationRow, MediaVariantRow, MediaListQuery } from './media.repository'
export const listMedia = implementation.listMedia
export const findMediaRow = implementation.findMediaRow
export const findMediaByStorageKey = implementation.findMediaByStorageKey
export const getMedia = implementation.getMedia
export const insertMedia = implementation.insertMedia
export const updateMediaRow = implementation.updateMediaRow
export const deleteMediaRow = implementation.deleteMediaRow
export const insertMediaVariants = implementation.insertMediaVariants
export const listVariantsForMedia = implementation.listVariantsForMedia
export const findVariantStorageKeys = implementation.findVariantStorageKeys
export const findVariantByStorageKey = implementation.findVariantByStorageKey
export const findMediaIdByHash = implementation.findMediaIdByHash
