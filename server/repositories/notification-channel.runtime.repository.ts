import * as mysql from './notification-channel.repository'
import * as postgres from './notification-channel.postgres.repository'
import { createDomainRepositoryContext } from './domain-context'

const implementation = createDomainRepositoryContext({ driver: process.env.DB_DRIVER }).isPostgres ? postgres : mysql
export const listNotificationChannels = implementation.listNotificationChannels
export const findNotificationChannel = implementation.findNotificationChannel
export const findEnabledNotificationChannel = implementation.findEnabledNotificationChannel
export const insertNotificationChannel = implementation.insertNotificationChannel
export const updateNotificationChannel = implementation.updateNotificationChannel
export const deleteNotificationChannel = implementation.deleteNotificationChannel
