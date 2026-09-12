import type { Translator } from '~/admin/core/types'
import { localizedInput, numberInput, selectInput, textInput, textarea } from '~/admin/schemas/builders/fields'

export default (t: Translator) => defineResource({
  name: 'membership/plans',
  model: 'MembershipPlan',
  label: t('res.membership.label'),
  labelPlural: t('res.membership.label'),
  icon: 'users',
  group: t('res.store.group'),
  sort: 33,
  permissionPrefix: 'store.membership',
  searchable: ['name'],

  table: () => [
    textColumn('name', t('res.membership.col.name'), { sortable: true }),
    textColumn('alias', t('res.store.col.alias')),
    moneyColumn('priceMinor', t('res.store.section.price')),
    textColumn('period', t('res.membership.col.period')),
    badgeColumn('status', t('res.posts.col.status'), {
      published: { label: t('status.published'), variant: 'success' },
      draft: { label: t('status.draft'), variant: 'warning' }
    }),
    dateColumn('createdAt', t('res.posts.col.created'))
  ],

  form: () => [
    section(t('res.membership.label'), [
      grid(2, [
        textInput('alias', t('res.store.col.alias'), {
          helpText: t('res.store.help.alias')
        }),
        selectInput('status', t('res.posts.field.status'), [
          { label: t('status.published'), value: 'published' },
          { label: t('status.draft'), value: 'draft' }
        ], { defaultValue: 'published' })
      ]),
      localizedInput('translations', t('res.membership.field.localized'), [
        textInput('name', t('res.membership.col.name'), { required: true }),
        textarea('description', t('res.membership.field.description'), { rows: 2 })
      ]),
      grid(3, [
        numberInput('priceMinor', t('res.store.field.priceAmount'), { min: 1, required: true, helpText: t('res.store.help.priceAmount') }),
        selectInput('currency', t('res.store.field.priceCurrency'), [
          { label: 'USD', value: 'USD' },
          { label: 'CNY', value: 'CNY' },
          { label: 'EUR', value: 'EUR' }
        ], { defaultValue: 'USD' }),
        selectInput('period', t('res.membership.col.period'), [
          { label: t('res.membership.period.month'), value: 'month' },
          { label: t('res.membership.period.year'), value: 'year' }
        ], { defaultValue: 'month' })
      ])
    ])
  ],

  infolist: () => [
    textEntry('name', t('res.membership.col.name')),
    textEntry('alias', t('res.store.col.alias')),
    textEntry('priceMinor', t('res.store.section.price'))
  ]
})
