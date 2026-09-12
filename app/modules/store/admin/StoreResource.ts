import type { BadgeStyle, Translator } from '~/admin/core/types'
import { localizedInput, relationInput, repeaterInput } from '~/admin/schemas/builders/fields'

export default (t: Translator) => {
  const statusBadges = (): Record<string | number, BadgeStyle> => ({
    published: { label: t('status.published'), variant: 'success' },
    draft: { label: t('status.draft'), variant: 'warning' },
    off_shelf: { label: t('res.store.status.offShelf'), variant: 'secondary' },
    archived: { label: t('status.archived'), variant: 'destructive' }
  })

  return defineResource({
    name: 'store/products',
    model: 'Product',
    label: t('res.store.label'),
    labelPlural: t('res.store.plural'),
    icon: 'shopping-cart',
    group: t('res.store.group'),
    sort: 32,
    permissionPrefix: 'store.products',
    searchable: ['title'],

    table: () => [
      imageColumn('image', t('res.store.col.image')),
      textColumn('title', t('res.store.col.title'), { sortable: true }),
      textColumn('alias', t('res.store.col.alias')),
      badgeColumn('status', t('res.posts.col.status'), statusBadges()),
      numberColumn('availableStock', t('res.store.col.stock')),
      dateColumn('createdAt', t('res.posts.col.created'))
    ],

    form: () => [
      section(t('res.store.section.general'), [
        grid(2, [
          textInput('alias', t('res.store.field.alias'), {
            helpText: t('res.store.help.alias')
          }),
          selectInput('status', t('res.posts.field.status'), [
            { label: t('status.draft'), value: 'draft' },
            { label: t('status.published'), value: 'published' },
            { label: t('res.store.status.offShelf'), value: 'off_shelf' },
            { label: t('status.archived'), value: 'archived' }
          ], { defaultValue: 'draft' })
        ]),
        grid(2, [
          selectInput('productType', t('res.store.field.type'), [
            { label: t('res.store.type.cardKey'), value: 'card_key' },
            { label: t('res.store.type.giftCard'), value: 'gift_card' },
            { label: t('res.store.type.account'), value: 'account' },
            { label: t('res.store.type.inviteCode'), value: 'invite_code' },
            { label: t('res.store.type.other'), value: 'other' }
          ], { defaultValue: 'card_key' }),
          selectInput('deliveryStrategy', t('res.store.field.delivery'), [
            { label: t('res.store.delivery.oneTimeReveal'), value: 'one_time_reveal' },
            { label: t('res.store.delivery.structuredReveal'), value: 'structured_reveal' },
            { label: t('res.store.delivery.link'), value: 'link' }
          ], { defaultValue: 'one_time_reveal' })
        ]),
        grid(2, [
          numberInput('maxQuantityPerOrder', t('res.store.field.maxQty'), { defaultValue: 1, min: 1, max: 100 }),
          relationInput('imageMediaId', t('res.store.field.image'), {
            resource: 'media',
            labelKey: 'filename'
          })
        ])
      ]),
      section(t('res.store.section.price'), [
        repeaterInput('prices', t('res.store.field.prices'), [
          selectInput('currency', t('res.store.field.priceCurrency'), [
            { label: 'USD', value: 'USD' },
            { label: 'EUR', value: 'EUR' },
            { label: 'CNY', value: 'CNY' },
            { label: 'JPY', value: 'JPY' }
          ]),
          numberInput('amountMinor', t('res.store.field.priceAmount'), { min: 0, helpText: t('res.store.help.priceAmount') })
        ], { helpText: t('res.store.help.prices') })
      ]),
      section(t('res.store.section.content'), [
        localizedInput('translations', t('res.store.field.content'), [
          textInput('title', t('res.store.field.title'), { required: true }),
          textarea('shortDescription', t('res.store.field.shortDescription'), { rows: 2 }),
          richTextInput('description', t('res.store.field.description'))
        ])
      ])
    ],

    infolist: () => [
      textEntry('title', t('res.store.col.title')),
      textEntry('alias', t('res.store.col.alias')),
      badgeEntry('status', t('res.posts.col.status'), statusBadges()),
      textEntry('availableStock', t('res.store.col.stock'))
    ]
  })
}
