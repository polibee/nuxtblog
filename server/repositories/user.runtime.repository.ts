import * as mysql from './user.repository'
import * as postgres from './user.postgres.repository'
import { createDomainRepositoryContext } from './domain-context'

const implementation = (createDomainRepositoryContext({ driver: process.env.DB_DRIVER }).isPostgres ? postgres : mysql) as typeof mysql
export type { UserRow, UserListQuery } from './user.repository'
export const listUsers = implementation.listUsers
export const findUserById = implementation.findUserById
export const findUserRowByEmail = implementation.findUserRowByEmail
export const findUserRowById = implementation.findUserRowById
export const emailExists = implementation.emailExists
export const insertUser = implementation.insertUser
export const updateUserRow = implementation.updateUserRow
export const deleteUserRow = implementation.deleteUserRow
export const countUsers = implementation.countUsers
export const countUsersByRoleAndStatus = implementation.countUsersByRoleAndStatus
export const countUsersByStatus = implementation.countUsersByStatus
