import * as mysql from './alias.mysql.repository'
import * as postgres from './alias.postgres.repository'
import { createDomainRepositoryContext } from './domain-context'

const context = createDomainRepositoryContext({
  driver: process.env.DB_DRIVER,
  repositories: { mysql, postgres }
})
const implementation = context.repository as typeof mysql

export const findRedirect = implementation.findRedirect
export const insertRedirect = implementation.insertRedirect
