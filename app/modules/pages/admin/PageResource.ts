import type { BadgeStyle, Translator } from '~/admin/core/types'
import { localizedInput } from '~/admin/schemas/builders/fields'

export default (t: Translator) => {
  const statusBadges = (): Record<string | number, BadgeStyle> => ({
    published: { label: t('status.published'), variant: 'success' },
    draft: { label: t('status.draft'), variant: 'warning' },
    archived: { label: t('status.archived'), variant: 'secondary' }
  })

  return defineResource({
    name: 'pages',
    model: 'Page',
    label: t('res.page.label'),
    labelPlural: t('res.page.plural'),
    icon: 'files',
    group: t('res.posts.group'),
    sort: 30,
    permissionPrefix: 'pages',
    searchable: ['title', 'slug'],

    table: () => [
      textColumn('title', t('res.page.col.title'), { sortable: true }),
      textColumn('template', t('res.page.col.template')),
      badgeColumn('status', t('res.posts.col.status'), statusBadges()),
      dateColumn('publishedAt', t('res.posts.col.published'), { sortable: true }),
      dateColumn('createdAt', t('res.posts.col.created'), { sortable: true }),
      actionsColumn([
        defineAction({
          name: 'view-public',
          label: t('res.posts.open'),
          icon: 'eye',
          permission: 'pages.view',
          visible: record => record.status === 'published',
          handler: async ({ record }) => {
            const page = await $fetch<Record<string, unknown>>(`/api/admin/pages/${record!.id}`)
            const translations = page.translations as Record<string, { slug?: string }>
            const primaryCode = page.primaryLocaleCode as string
            const slug = translations?.[primaryCode]?.slug ?? ''
            if (import.meta.client && slug) window.open(`/pages/${slug}`, '_blank', 'noopener')
          }
        })
      ])
    ],

    form: () => [
      section(t('res.page.section.general'), [
        grid(2, [
          selectInput('status', t('res.posts.field.status'), [
            { label: t('status.draft'), value: 'draft' },
            { label: t('status.published'), value: 'published' },
            { label: t('status.archived'), value: 'archived' }
          ], { defaultValue: 'draft' }),
          selectInput('template', t('res.page.field.template'), [
            { label: t('res.page.template.default'), value: 'default' },
            { label: t('res.page.template.landing'), value: 'landing' },
            { label: t('res.page.template.friendLinks'), value: 'friend_links' }
          ], { defaultValue: 'default' })
        ]),
        textInput('alias', t('res.posts.field.alias'), {
          required: true,
          colSpan: 2,
          helpText: t('res.posts.help.alias')
        })
      ]),
      section(t('res.page.section.content'), [
        localizedInput('translations', t('res.posts.field.localized'), [
          textInput('title', t('res.page.col.title'), { required: true, colSpan: 2 }),
          richTextInput('content', t('res.posts.field.content'), { colSpan: 2 }),
          textInput('seoTitle', t('res.posts.field.seoTitle'), { colSpan: 2 }),
          textarea('seoDescription', t('res.posts.field.seoDescription'), { rows: 2, colSpan: 2 }),
          switchInput('noindex', t('res.posts.field.noindex'))
        ])
      ])
    ],

    infolist: () => [
      textEntry('title', t('res.page.col.title')),
      textEntry('template', t('res.page.col.template')),
      badgeEntry('status', t('res.posts.col.status'), statusBadges()),
      textEntry('primaryLocaleCode', t('res.posts.field.primaryLocale')),
      dateEntry('publishedAt', t('res.posts.col.published')),
      dateEntry('createdAt', t('res.posts.col.created'))
    ]
  })
}
