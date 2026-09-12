import type { Translator } from '~/admin/core/types'
import ProfileManagerPage from './ProfileManagerPage.vue'

/* P29 /profile editor: single-author bundle editor, one bulk save. */

export default (t: Translator) => defineResource({
  name: 'author-profile',
  model: 'AuthorProfile',
  label: t('res.profile.label'),
  labelPlural: t('res.profile.label'),
  icon: 'user-round',
  group: t('group.content'),
  sort: 17,
  permissionPrefix: 'profile',
  pages: {
    list: ProfileManagerPage
  },
  table: () => []
})
