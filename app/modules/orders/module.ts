import OrderResource from './admin/OrderResource'
import TransactionsResource from './admin/TransactionsResource'

export default defineModule(t => ({
  name: 'orders',
  resources: [OrderResource(t), TransactionsResource(t)],
  navGroups: [{ label: t('res.orders.group'), sort: 30 }]
}))
