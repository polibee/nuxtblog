import type { Translator } from '~/admin/core/types'
import NavigationManagerPage from './NavigationManagerPage.vue'

/* WordPress-style visual navigation manager (navigation-menu-design.md
   P06.2). The list page is fully replaced by the manager component. */

export default (t: Translator) => defineResource({
  name: 'navigations',
  model: 'Navigation',
  label: t('res.navigation.label'),
  labelPlural: t('res.navigation.plural'),
  icon: 'menu',
  group: t('res.navigation.group'),
  sort: 46,
  permissionPrefix: 'navigation',
  // required by the admin route guard even though the list page is overridden
  table: () => [
    textColumn('adminName', t('res.menus.field.name')),
    textColumn('location', t('res.navigation.field.key'))
  ],
  pages: {
    list: NavigationManagerPage
  }
})
