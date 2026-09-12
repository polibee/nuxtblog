import BackupResource from './admin/BackupResource'

export default defineModule(t => ({
  name: 'backup',
  resources: [BackupResource(t)],
  navGroups: [{ label: t('group.system'), sort: 60 }]
}))
