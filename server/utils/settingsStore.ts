import {
  createSetting,
  getSettingItem,
  updateSettingValue
} from '../modules/settings/settings.runtime.service'

/** Upsert a settings row by key (value-only update when it exists). */
export async function upsertSettingByKey(key: string, value: string | number | boolean, opts?: { secret?: boolean, group?: string }): Promise<void> {
  const existing = await getSettingItem(key)
  if (existing) {
    await updateSettingValue(existing.id, value)
    return
  }
  await createSetting({
    key,
    value,
    type: opts?.secret ? 'secret' : 'string',
    group: opts?.group ?? 'Storage',
    public: false,
    description: `Managed via the Database settings panel (${key})`
  })
}
