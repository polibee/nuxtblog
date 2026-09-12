import type { BadgeStyle, Translator } from '~/admin/core/types'
import { mediaPicker, numberInput, selectInput, textInput } from '~/admin/schemas/builders/fields'

export default (t: Translator) => {
  const typeBadges = (): Record<string | number, BadgeStyle> => ({
    html: { label: 'HTML', variant: 'default' },
    link: { label: t('res.sidebar.type.link'), variant: 'success' },
    image_link: { label: t('res.sidebar.type.imageLink'), variant: 'secondary' },
    js_ad: { label: t('res.sidebar.type.jsAd'), variant: 'warning' },
    latest_posts: { label: t('res.sidebar.type.latestPosts'), variant: 'secondary' },
    membership_plans: { label: t('res.sidebar.type.membership'), variant: 'secondary' },
    article_toc: { label: t('res.sidebar.type.articleToc'), variant: 'secondary' },
    ad_slot: { label: t('res.sidebar.type.adSlot'), variant: 'warning' },
    author: { label: t('res.sidebar.type.author'), variant: 'success' }
  })

  const typeOptions = [
    { label: 'HTML', value: 'html' },
    { label: t('res.sidebar.type.link'), value: 'link' },
    { label: t('res.sidebar.type.imageLink'), value: 'image_link' },
    { label: t('res.sidebar.type.jsAd'), value: 'js_ad' },
    { label: t('res.sidebar.type.latestPosts'), value: 'latest_posts' },
    { label: t('res.sidebar.type.membership'), value: 'membership_plans' },
    { label: t('res.sidebar.type.articleToc'), value: 'article_toc' },
    { label: t('res.sidebar.type.adSlot'), value: 'ad_slot' },
    { label: t('res.sidebar.type.author'), value: 'author' }
  ]

  return defineResource({
    name: 'sidebar-cards',
    model: 'SidebarCard',
    label: t('res.sidebar.label'),
    labelPlural: t('res.sidebar.plural'),
    icon: 'menu',
    group: t('group.content'),
    sort: 15,
    permissionPrefix: 'sidebar-cards',
    searchable: ['title'],

    table: () => [
      textColumn('title', t('res.sidebar.col.title'), { sortable: true }),
      badgeColumn('type', t('res.sidebar.col.type'), typeBadges()),
      booleanColumn('enabled', t('res.sidebar.col.enabled')),
      numberColumn('sortOrder', t('res.sidebar.col.sort'), { sortable: true }),
      dateColumn('createdAt', t('res.sidebar.col.created'))
    ],

    form: () => [
      section(t('res.sidebar.section.general'), [
        grid(2, [
          selectInput('type', t('res.sidebar.field.type'), typeOptions, { defaultValue: 'html' }),
          numberInput('sortOrder', t('res.sidebar.field.sort'), { defaultValue: 0, min: 0, max: 9999 })
        ]),
        switchInput('enabled', t('res.sidebar.field.enabled'), { defaultValue: true })
      ]),
      section(t('res.sidebar.section.link'), [
        grid(2, [
          textInput('linkUrl', t('res.sidebar.field.linkUrl'), {
            helpText: t('res.sidebar.help.linkUrl')
          }),
          mediaPicker('imageMediaId', t('res.sidebar.field.image'), {
            helpText: t('res.sidebar.help.image')
          })
        ])
      ]),
      section(t('res.sidebar.section.content'), [
        localizedInput('translations', t('res.sidebar.field.content'), [
          textInput('title', t('res.sidebar.field.title'), { required: true }),
          richTextInput('content', t('res.sidebar.field.body'), { required: true, helpText: t('res.sidebar.help.content') })
        ])
      ])
    ],

    infolist: () => [
      textEntry('title', t('res.sidebar.field.title')),
      badgeEntry('type', t('res.sidebar.col.type'), typeBadges()),
      booleanEntry('enabled', t('res.sidebar.col.enabled')),
      textEntry('sortOrder', t('res.sidebar.col.sort')),
      dateEntry('createdAt', t('res.sidebar.col.created'))
    ]
  })
}
