import type { Translator } from '~/admin/core/types'
import FriendLinksManagerPage from './admin/FriendLinksManagerPage.vue'

/* Friend links manager (docs/友链.txt §37/94): content-group module for
   blogroll data + submission review. The friend_links PAGE is a normal
   Page with template=friend_links; this module owns the data (Rule 1). */

const FriendLinksResource = (t: Translator) => defineResource({
  name: 'friend-links',
  model: 'FriendLink',
  label: t('res.friendlinks.label'),
  labelPlural: t('res.friendlinks.label'),
  icon: 'link',
  group: t('group.content'),
  sort: 18,
  permissionPrefix: 'friend-links',
  pages: {
    list: FriendLinksManagerPage
  },
  table: () => []
})

export default defineModule(t => ({
  name: 'friend-links',
  resources: [FriendLinksResource(t)],
  navGroups: [{ label: t('group.content'), sort: 15 }]
}))
