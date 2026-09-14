import type { Translator } from '~/admin/core/types'
import { relationInput, numberInput, switchInput } from '~/admin/schemas/builders/fields'

export default (t: Translator) => {
  return defineResource({
    name: 'advertising/placements',
    model: 'AdPlacement',
    label: t('res.adplacements.label'),
    labelPlural: t('res.adplacements.label'),
    icon: 'link',
    group: t('res.advertising.group'),
    sort: 37,
    permissionPrefix: 'advertising',

    table: () => [
      textColumn('slotKey', t('res.adslots.col.key'), { sortable: true }),
      numberColumn('campaignId', t('res.adcampaigns.label')),
      numberColumn('priority', t('res.sidebar.col.sort'), { sortable: true }),
      booleanColumn('enabled', t('res.sidebar.col.enabled'))
    ],

    form: () => [
      section(t('res.adplacements.label'), [
        grid(2, [
          textInput('slotKey', t('res.adslots.col.key'), {
            required: true,
            helpText: t('res.adslots.help.key')
          }),
          relationInput('campaignId', t('res.adcampaigns.label'), {
            resource: 'advertising/campaigns',
            labelKey: 'name'
          })
        ]),
        grid(2, [
          numberInput('priority', t('res.sidebar.col.sort'), { defaultValue: 0 }),
          switchInput('enabled', t('res.sidebar.col.enabled'), { defaultValue: true })
        ])
      ])
    ],

    infolist: () => [
      textEntry('slotKey', t('res.adslots.col.key')),
      textEntry('campaignId', t('res.adcampaigns.label'))
    ]
  })
}
