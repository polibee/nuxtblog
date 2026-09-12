import StoreResource from './admin/StoreResource'

export default defineModule(t => ({
  name: 'store',
  resources: [StoreResource(t)],
  navGroups: [{ label: t('res.store.group'), sort: 33 }]
}))
