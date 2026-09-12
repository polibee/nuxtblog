import * as mysql from './notification-subscription.repository'
import * as postgres from './notification-subscription.postgres.repository'
import { createDomainRepositoryContext } from './domain-context'

const implementation = createDomainRepositoryContext({ driver: process.env.DB_DRIVER }).isPostgres ? postgres : mysql
export const listNotificationSubscriptions = implementation.listNotificationSubscriptions
export const insertNotificationSubscription = implementation.insertNotificationSubscription
export const updateNotificationSubscription = implementation.updateNotificationSubscription
export const deleteNotificationSubscription = implementation.deleteNotificationSubscription
export const listEnabledSubscriptions = implementation.listEnabledSubscriptions
export const listMatchedSubscriptionIds = implementation.listMatchedSubscriptionIds
