import type { Translator } from '~/admin/core/types'
import NotificationsManagerPage from './admin/NotificationsManagerPage.vue'

/* P38 Notifications (docs/webhook.txt §3/82): channel providers +
   subscription-centric event routing + delivery logs. The module owns
   the notification data; Settings only holds master switches. */

const NotificationsResource = (t: Translator) => defineResource({
  name: 'notifications',
  model: 'NotificationChannel',
  label: t('res.notifications.label'),
  labelPlural: t('res.notifications.label'),
  icon: 'bell',
  group: t('res.notifications.group'),
  sort: 58,
  permissionPrefix: 'notifications',
  pages: {
    list: NotificationsManagerPage
  },
  table: () => []
})

export default defineModule(t => ({
  name: 'notifications',
  resources: [NotificationsResource(t)],
  navGroups: [{ label: t('res.notifications.group'), sort: 58 }]
}))
