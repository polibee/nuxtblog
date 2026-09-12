import * as mysql from './friend-link-category.repository'
import * as postgres from './friend-link-category.postgres.repository'
import { createDomainRepositoryContext } from './domain-context'

const implementation = createDomainRepositoryContext({ driver: process.env.DB_DRIVER }).isPostgres ? postgres : mysql
export const listPublicFriendLinkCategories = implementation.listPublicFriendLinkCategories
