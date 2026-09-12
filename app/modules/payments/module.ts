import PaymentGatewaysResource from './admin/PaymentGatewaysResource'

export default defineModule(t => ({
  name: 'payments',
  resources: [PaymentGatewaysResource(t)],
  navGroups: [{ label: t('res.store.group'), sort: 30 }]
}))
