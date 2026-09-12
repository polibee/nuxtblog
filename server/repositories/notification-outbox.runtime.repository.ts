import * as mysql from './notification-outbox.repository'
import * as postgres from './notification-outbox.postgres.repository'
import { createDomainRepositoryContext } from './domain-context'

const implementation = createDomainRepositoryContext({ driver: process.env.DB_DRIVER }).isPostgres ? postgres : mysql
export const findRecentOutbox = implementation.findRecentOutbox
export const incrementOutboxSuppressed = implementation.incrementOutboxSuppressed
export const insertOutbox = implementation.insertOutbox
export const listPendingOutbox = implementation.listPendingOutbox
export const findOutbox = implementation.findOutbox
export const markOutboxProcessed = implementation.markOutboxProcessed
export const claimPendingOutbox = implementation.claimPendingOutbox
