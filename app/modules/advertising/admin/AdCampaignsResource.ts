import type { BadgeStyle, Translator } from '~/admin/core/types'
import { dateInput, numberInput, selectInput, textInput } from '~/admin/schemas/builders/fields'
import CampaignsManagerPage from './CampaignsManagerPage.vue'

export default (t: Translator) => {
  const statusBadges = (): Record<string | number, BadgeStyle> => ({
    draft: { label: t('status.draft'), variant: 'warning' },
    active: { label: t('status.paid'), variant: 'success' },
    paused: { label: t('status.pending'), variant: 'secondary' },
    ended: { label: t('status.archived'), variant: 'destructive' }
  })

  return defineResource({
    name: 'advertising/campaigns',
    model: 'AdCampaign',
    label: t('res.adcampaigns.label'),
    labelPlural: t('res.adcampaigns.label'),
    icon: 'target',
    group: t('res.advertising.group'),
    sort: 35,
    permissionPrefix: 'advertising',
    searchable: ['name'],
    pages: {
      list: CampaignsManagerPage
    },

    table: () => [
      textColumn('name', t('res.adcampaigns.col.name'), { sortable: true }),
      badgeColumn('status', t('res.trans.col.status'), statusBadges()),
      dateColumn('startAt', t('res.eximp.dateFrom')),
      dateColumn('endAt', t('res.eximp.dateTo'))
    ],

    form: () => [
      section(t('res.adcampaigns.label'), [
        grid(2, [
          textInput('name', t('res.adcampaigns.col.name'), { required: true }),
          selectInput('status', t('res.trans.col.status'), [
            { label: t('status.draft'), value: 'draft' },
            { label: t('status.paid'), value: 'active' },
            { label: t('status.pending'), value: 'paused' },
            { label: t('status.archived'), value: 'ended' }
          ], { defaultValue: 'draft' })
        ]),
        grid(2, [
          numberInput('budgetMinor', t('res.adcampaigns.field.budget'), {
            defaultValue: 0,
            min: 0,
            helpText: t('res.adcampaigns.help.budget')
          }),
          selectInput('currency', t('res.adcampaigns.field.currency'), [
            { label: 'USD', value: 'USD' },
            { label: 'CNY', value: 'CNY' },
            { label: 'EUR', value: 'EUR' }
          ], { defaultValue: 'USD' })
        ]),
        grid(2, [
          dateInput('startAt', t('res.eximp.dateFrom')),
          dateInput('endAt', t('res.eximp.dateTo'))
        ])
      ])
    ],

    infolist: () => [
      textEntry('name', t('res.adcampaigns.col.name')),
      badgeEntry('status', t('res.trans.col.status'), statusBadges()),
      moneyEntry('budgetMinor', t('res.adcampaigns.field.budget'))
    ]
  })
}
