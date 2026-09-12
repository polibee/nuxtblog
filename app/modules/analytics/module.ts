import AnalyticsResource from './admin/AnalyticsResource'

export default defineModule(t => ({
  name: 'analytics',
  resources: [AnalyticsResource(t)],
  navGroups: [{ label: t('res.analytics.group'), sort: 48 }]
}))
