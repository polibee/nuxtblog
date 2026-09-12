import ExportsResource from './admin/ExportsResource'

export default defineModule(t => ({
  name: 'exports',
  resources: [ExportsResource(t)],
  navGroups: [{ label: t('res.store.group'), sort: 30 }]
}))
