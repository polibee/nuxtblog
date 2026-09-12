import * as mysql from './locale.repository'
import * as postgres from './locale.postgres.repository'
import { createDomainRepositoryContext } from './domain-context'

const usePostgres = createDomainRepositoryContext({ driver: process.env.DB_DRIVER }).isPostgres
const implementation = (usePostgres ? postgres : mysql) as typeof mysql

export type { LocaleWriteInput } from './locale.repository'
export const listLocales = implementation.listLocales
export const findLocaleByCode = implementation.findLocaleByCode
export const findLocaleById = implementation.findLocaleById
export const findDefaultLocale = implementation.findDefaultLocale
export const insertLocale = implementation.insertLocale
export const updateLocaleRow = implementation.updateLocaleRow
export const clearDefaultFlags = implementation.clearDefaultFlags
export const countLocales = implementation.countLocales
export const countContentLocales = implementation.countContentLocales
export const deleteLocaleRow = implementation.deleteLocaleRow
