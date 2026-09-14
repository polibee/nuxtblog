import * as mysql from './session.repository'
import * as postgres from './session.postgres.repository'
import { createDomainRepositoryContext } from './domain-context'

const implementation = (createDomainRepositoryContext({ driver: process.env.DB_DRIVER }).isPostgres ? postgres : mysql) as typeof mysql
export const createSession = implementation.createSession
export const findActiveSession = implementation.findActiveSession
export const deleteSession = implementation.deleteSession
export const deleteSessionsForUser = implementation.deleteSessionsForUser
export const deleteSessionsForUserExcept = implementation.deleteSessionsForUserExcept
export const deleteExpiredSessions = implementation.deleteExpiredSessions
export const createResetToken = implementation.createResetToken
export const findUsableResetToken = implementation.findUsableResetToken
export const markResetTokenUsed = implementation.markResetTokenUsed
