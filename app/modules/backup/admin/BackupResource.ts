import type { Translator } from '~/admin/core/types'
import BackupManagerPage from './BackupManagerPage.vue'

export default (t: Translator) => defineResource({
  name: 'backup',
  model: 'BackupJob',
  label: t('res.backup.label'),
  labelPlural: t('res.backup.label'),
  icon: 'database',
  group: t('group.system'),
  sort: 60,
  permissionPrefix: 'backup',
  pages: {
    list: BackupManagerPage
  },
  table: () => []
})
