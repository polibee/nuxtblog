import LocaleResource from './admin/LocaleResource'

export default defineModule(t => ({
  name: 'locales',
  resources: [LocaleResource(t)],
  navGroups: [{ label: t('group.system'), sort: 96 }]
}))
