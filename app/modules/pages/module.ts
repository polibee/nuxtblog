import PageResource from './admin/PageResource'

export default defineModule(t => ({
  name: 'pages',
  resources: [PageResource(t)],
  navGroups: [{ label: t('res.posts.group'), sort: 30 }]
}))
