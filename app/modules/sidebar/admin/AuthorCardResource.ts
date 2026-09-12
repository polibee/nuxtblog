import type { Translator } from '~/admin/core/types'
import AuthorCardManagerPage from './AuthorCardManagerPage.vue'

/* Dedicated visual editor for the sidebar Author Card (docs Author Card
   设计方案 §41-44): live 300px sidebar preview + form, no JSON editing. */

export default (t: Translator) => defineResource({
  name: 'author-card',
  model: 'SidebarCard',
  label: t('res.authorcard.label'),
  labelPlural: t('res.authorcard.label'),
  icon: 'user',
  group: t('group.mediaLibrary'),
  sort: 16,
  permissionPrefix: 'sidebar-cards',
  pages: {
    list: AuthorCardManagerPage
  },
  table: () => []
})
