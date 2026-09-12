import type { Translator } from '~/admin/core/types'
import GatewaysManagerPage from './GatewaysManagerPage.vue'

export default (t: Translator) => defineResource({
  name: 'payment-gateways',
  model: 'PaymentGateway',
  label: t('res.paygw.title'),
  labelPlural: t('res.paygw.title'),
  icon: 'credit-card',
  group: t('res.store.group'),
  sort: 34,
  permissionPrefix: 'store.payments',
  pages: {
    list: GatewaysManagerPage
  },
  table: () => []
})
