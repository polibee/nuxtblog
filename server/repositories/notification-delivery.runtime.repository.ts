import * as mysql from './notification-delivery.repository'
import * as postgres from './notification-delivery.postgres.repository'
import { createDomainRepositoryContext } from './domain-context'

const implementation = createDomainRepositoryContext({ driver: process.env.DB_DRIVER }).isPostgres ? postgres : mysql
export const findDelivery = implementation.findDelivery
export const findDeliveryContext = implementation.findDeliveryContext
export const updateDelivery = implementation.updateDelivery
export const listDueDeliveries = implementation.listDueDeliveries
export const insertDelivery = implementation.insertDelivery
export const listPendingDeliveries = implementation.listPendingDeliveries
