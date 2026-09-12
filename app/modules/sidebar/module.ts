import SidebarCardResource from './admin/SidebarCardResource'
import AuthorCardResource from './admin/AuthorCardResource'

export default defineModule(t => ({
  name: 'sidebar',
  resources: [SidebarCardResource(t), AuthorCardResource(t)],
  navGroups: [{ label: t('group.content'), sort: 15 }]
}))
