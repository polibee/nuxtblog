import ProfileResource from './admin/ProfileResource'

export default defineModule(t => ({
  name: 'author',
  resources: [ProfileResource(t)],
  navGroups: [{ label: t('group.content'), sort: 15 }]
}))
