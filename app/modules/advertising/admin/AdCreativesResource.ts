import type { Translator } from '~/admin/core/types'
import { localizedInput, mediaPicker, numberInput, relationInput, selectInput, switchInput } from '~/admin/schemas/builders/fields'

export default (t: Translator) => {
  return defineResource({
    name: 'advertising/creatives',
    model: 'AdCreative',
    label: t('res.adcreatives.label'),
    labelPlural: t('res.adcreatives.label'),
    icon: 'image',
    group: t('res.advertising.group'),
    sort: 36,
    permissionPrefix: 'advertising',
    searchable: ['title'],

    table: () => [
      numberColumn('id', t('res.trans.col.number')),
      textColumn('campaignName', t('res.adcampaigns.label'), { sortable: true }),
      badgeColumn('provider', t('res.adcreatives.col.provider'), {
        image: { label: 'Image', variant: 'success' },
        affiliate: { label: 'Affiliate', variant: 'secondary' },
        adsense: { label: 'AdSense', variant: 'warning' }
      }),
      numberColumn('impressions', t('res.adcreatives.col.impressions'), { sortable: true }),
      numberColumn('clicks', t('res.adcreatives.col.clicks'), { sortable: true }),
      booleanColumn('enabled', t('res.sidebar.col.enabled')),
      dateColumn('createdAt', t('res.posts.col.created'))
    ],

    form: () => [
      section(t('res.adcreatives.label'), [
        grid(2, [
          relationInput('campaignId', t('res.adcampaigns.label'), {
            resource: 'advertising/campaigns',
            labelKey: 'name'
          }),
          selectInput('provider', t('res.adcreatives.col.provider'), [
            { label: 'Image', value: 'image' },
            { label: 'Affiliate', value: 'affiliate' },
            { label: 'AdSense', value: 'adsense' }
          ], { defaultValue: 'image' })
        ]),
        grid(2, [
          numberInput('weight', t('res.adcreatives.col.weight'), { defaultValue: 1, min: 1 }),
          switchInput('enabled', t('res.sidebar.col.enabled'), { defaultValue: true })
        ])
      ]),
      section(t('res.sidebar.section.link'), [
        grid(2, [
          textInput('targetUrl', t('res.sidebar.field.linkUrl'), { helpText: t('res.sidebar.help.linkUrl') }),
          mediaPicker('imageId', t('res.sidebar.field.image'))
        ])
      ]),
      section(t('res.adcreatives.field.localized'), [
        localizedInput('translations', t('res.adcreatives.field.localized'), [
          textInput('title', t('res.membership.col.name'), { required: true }),
          textarea('content', t('res.membership.field.description'), { rows: 2 }),
          textInput('buttonText', t('res.adcreatives.field.buttonText')),
          textInput('altText', t('res.adcreatives.field.altText'))
        ])
      ])
    ],

    infolist: () => [
      textEntry('provider', t('res.adcreatives.col.provider')),
      textEntry('impressions', t('res.adcreatives.col.impressions')),
      textEntry('clicks', t('res.adcreatives.col.clicks')),
      booleanEntry('enabled', t('res.sidebar.col.enabled'))
    ]
  })
}
