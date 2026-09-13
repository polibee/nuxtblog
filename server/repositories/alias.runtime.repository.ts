import * as mysql from './alias.mysql.repository'
import * as postgres from './alias.postgres.repository'
import { createDomainRepositoryContext } from './domain-context'

const implementation = (createDomainRepositoryContext({ driver: process.env.DB_DRIVER }).isPostgres ? postgres : mysql) as typeof mysql

export const findRedirect = implementation.findRedirect
export const insertRedirect = implementation.insertRedirect
