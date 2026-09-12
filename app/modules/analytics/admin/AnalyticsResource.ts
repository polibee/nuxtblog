import type { Translator } from '~/admin/core/types'
import AnalyticsPage from './AnalyticsPage.vue'

export default (t: Translator) => defineResource({
  name: 'analytics',
  model: 'Analytics',
  label: t('res.analytics.title'),
  labelPlural: t('res.analytics.title'),
  icon: 'activity',
  group: t('res.navigation.group'),
  sort: 50,
  permissionPrefix: 'analytics',
  pages: {
    list: AnalyticsPage
  },
  table: () => []
})
