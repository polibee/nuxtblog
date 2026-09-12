import { requirePermission } from '../../../utils/auth'
import { listSettingsPageDefs, SETTINGS_GROUP_LABELS } from '../../../modules/settings/registry'
import { settingsSearchIndex } from '../../../modules/settings/ui.service'

/** GET /api/admin/settings-ui — settings navigation + search index
    (设置.txt §15/16): pages grouped by group with field-level search
    metadata. */
export default defineEventHandler(async (event) => {
  await requirePermission(event, 'settings.view')
  const pages = listSettingsPageDefs().map(page => ({
    id: page.id,
    group: page.group,
    groupLabel: SETTINGS_GROUP_LABELS[page.group],
    title: page.title,
    description: page.description,
    icon: page.icon,
    module: page.module ?? null
  }))
  return { pages, groups: SETTINGS_GROUP_LABELS, searchIndex: settingsSearchIndex() }
})
