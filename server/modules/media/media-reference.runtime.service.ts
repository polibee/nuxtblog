import * as mysql from './media-reference.service'
import * as postgres from './media-reference.postgres.service'
import { createDomainRepositoryContext } from '../../repositories/domain-context'

const implementation = (createDomainRepositoryContext({ driver: process.env.DB_DRIVER }).isPostgres ? postgres : mysql)
export const findMediaReferences = implementation.findMediaReferences
