import * as mysql from './taxonomy.repository'
import * as postgres from './taxonomy.postgres.repository'
import { createDomainRepositoryContext } from './domain-context'

const implementation = (createDomainRepositoryContext({ driver: process.env.DB_DRIVER }).isPostgres ? postgres : mysql) as typeof mysql
export type { TaxonomyKind, TaxonomyRecord, TaxonomyTranslationRow } from './taxonomy.repository'
export const listTaxonomy = implementation.listTaxonomy
export const findTaxonomyRow = implementation.findTaxonomyRow
export const insertTaxonomy = implementation.insertTaxonomy
export const updateTaxonomy = implementation.updateTaxonomy
export const deleteTaxonomy = implementation.deleteTaxonomy
export const termsForLocale = implementation.termsForLocale
export const replacePostRelations = implementation.replacePostRelations
export const relationsForPost = implementation.relationsForPost
export const postsInTaxonomy = implementation.postsInTaxonomy
export const findTaxonomyAliasById = implementation.findTaxonomyAliasById
