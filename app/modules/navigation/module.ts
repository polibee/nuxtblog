import NavigationResource from './admin/NavigationResource'

export default defineModule(t => ({
  name: 'navigation',
  resources: [NavigationResource(t)],
  navGroups: [{ label: t('res.navigation.group'), sort: 46 }]
}))
