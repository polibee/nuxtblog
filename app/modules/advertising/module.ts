import AdSlotsResource from './admin/AdSlotsResource'
import AdCampaignsResource from './admin/AdCampaignsResource'
import AdCreativesResource from './admin/AdCreativesResource'
import AdPlacementsResource from './admin/AdPlacementsResource'

export default defineModule(t => ({
  name: 'advertising',
  resources: [
    AdSlotsResource(t),
    AdCampaignsResource(t),
    AdCreativesResource(t),
    AdPlacementsResource(t)
  ],
  navGroups: [{ label: t('res.advertising.group'), sort: 33 }]
}))
