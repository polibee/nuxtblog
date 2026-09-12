import type { BadgeStyle, Translator } from '~/admin/core/types'

export default (t: Translator) => {
  const typeBadges = (): Record<string | number, BadgeStyle> => ({
    charge: { label: t('res.trans.type.charge'), variant: 'success' },
    refund: { label: t('res.trans.type.refund'), variant: 'destructive' },
    fee: { label: t('res.trans.type.fee'), variant: 'warning' },
    adjustment: { label: t('res.trans.type.adjustment'), variant: 'secondary' },
    chargeback: { label: t('res.trans.type.chargeback'), variant: 'destructive' }
  })

  const statusBadges = (): Record<string | number, BadgeStyle> => ({
    completed: { label: t('status.completed'), variant: 'success' },
    pending: { label: t('status.pending'), variant: 'warning' },
    failed: { label: t('status.failed'), variant: 'destructive' }
  })

  return defineResource({
    name: 'transactions',
    model: 'FinancialTransaction',
    label: t('res.trans.label'),
    labelPlural: t('res.trans.label'),
    icon: 'receipt',
    group: t('res.orders.group'),
    sort: 31,
    permissionPrefix: 'store.orders',
    searchable: ['transactionNumber'],

    table: () => [
      textColumn('transactionNumber', t('res.trans.col.number'), { sortable: true }),
      badgeColumn('type', t('res.trans.col.type'), typeBadges()),
      badgeColumn('status', t('res.trans.col.status'), statusBadges()),
      numberColumn('amountMinor', t('res.orders.col.amount')),
      textColumn('currency', t('res.trans.col.currency')),
      textColumn('orderNumber', t('res.trans.col.order')),
      textColumn('gatewayKey', t('res.trans.col.gateway')),
      dateColumn('occurredAt', t('res.trans.col.date'), { sortable: true })
    ],

    infolist: () => [
      textEntry('transactionNumber', t('res.trans.col.number')),
      badgeEntry('type', t('res.trans.col.type'), typeBadges()),
      textEntry('amountMinor', t('res.orders.col.amount')),
      textEntry('orderNumber', t('res.trans.col.order')),
      textEntry('gatewayKey', t('res.trans.col.gateway')),
      textEntry('description', t('res.trans.col.description'))
    ]
  })
}
