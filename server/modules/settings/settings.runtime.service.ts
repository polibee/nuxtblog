import * as mysql from './settings.service'
import * as postgres from './settings.postgres.service'

const usePostgres = process.env.DB_DRIVER === 'postgres' || process.env.DB_DRIVER === 'supabase'
const implementation = (usePostgres ? postgres : mysql) as typeof mysql

export type { SettingType, SettingItem } from './settings.service'
export const invalidateSettingsCache = implementation.invalidateSettingsCache
export const coerceSettingValue = implementation.coerceSettingValue
export const listSettings = implementation.listSettings
export const getSettingValue = implementation.getSettingValue
export const getSettingItem = implementation.getSettingItem
export const createSetting = implementation.createSetting
export const updateSettingValue = implementation.updateSettingValue
export const deleteSetting = implementation.deleteSetting
export const publicSettingsMap = implementation.publicSettingsMap
export const localizedSettingsMap = implementation.localizedSettingsMap
export const setLocalizedSetting = implementation.setLocalizedSetting
export const listLocalizedSettings = implementation.listLocalizedSettings
export const deleteLocalizedSetting = implementation.deleteLocalizedSetting
export const seedDefaultSettings = implementation.seedDefaultSettings
export const seedLocalizedSettings = implementation.seedLocalizedSettings
