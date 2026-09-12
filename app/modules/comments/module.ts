import CommentsResource from './admin/CommentsResource'

export default defineModule(t => ({
  name: 'comments',
  resources: [CommentsResource(t)],
  navGroups: [{ label: t('group.content'), sort: 36 }]
}))
