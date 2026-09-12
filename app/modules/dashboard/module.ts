import WidgetStats from './widgets/WidgetStats.vue'
import WidgetRecentPosts from './widgets/WidgetRecentPosts.vue'
import CacheMonitor from './widgets/CacheMonitor.vue'

export default defineModule(t => ({
  name: 'dashboard',
  navGroups: [{ label: t('nav.general'), sort: 0 }],
  widgets: [
    { name: 'stats-overview', span: 4, order: 1, component: WidgetStats },
    { name: 'recent-posts', label: t('widget.recentPosts'), span: 2, order: 2, component: WidgetRecentPosts },
    { name: 'cache-monitor', label: t('cache.title'), span: 2, order: 3, component: CacheMonitor }
  ]
}))
