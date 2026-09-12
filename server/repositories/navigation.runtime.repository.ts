import * as mysql from './navigation.repository'
import * as postgres from './navigation.postgres.repository'
import { createDomainRepositoryContext } from './domain-context'

const implementation = (createDomainRepositoryContext({ driver: process.env.DB_DRIVER }).isPostgres ? postgres : mysql) as typeof mysql
export type { NavigationVariantMeta, NavigationRecord, NavigationItemRow, ItemInsertRow } from './navigation.repository'
export const listNavigations = implementation.listNavigations
export const findNavigationRow = implementation.findNavigationRow
export const findNavigationByLocation = implementation.findNavigationByLocation
export const updateNavigationMeta = implementation.updateNavigationMeta
export const updateVariantStatus = implementation.updateVariantStatus
export const insertNavigation = implementation.insertNavigation
export const findVariant = implementation.findVariant
export const findVariantById = implementation.findVariantById
export const insertVariant = implementation.insertVariant
export const deleteVariant = implementation.deleteVariant
export const deleteNavigationRow = implementation.deleteNavigationRow
export const clearDefaultFlags = implementation.clearDefaultFlags
export const listVariantItems = implementation.listVariantItems
export const replaceVariantItems = implementation.replaceVariantItems
export const copyVariantItems = implementation.copyVariantItems
