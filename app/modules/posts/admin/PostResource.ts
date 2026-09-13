import type { BadgeStyle, Translator } from '~/admin/core/types'
import { localizedInput, multiRelationInput } from '~/admin/schemas/builders/fields'

export default (t: Translator) => {
  const statusBadges = (): Record<string | number, BadgeStyle> => ({
    published: { label: t('status.published'), variant: 'success' },
    draft: { label: t('status.draft'), variant: 'warning' },
    scheduled: { label: t('status.scheduled'), variant: 'default' },
    archived: { label: t('status.archived'), variant: 'secondary' }
  })

  return defineResource({
    name: 'posts',
    model: 'Post',
    label: t('res.posts.label'),
    labelPlural: t('res.posts.plural'),
    icon: 'file-text',
    group: t('res.posts.group'),
    sort: 20,
    permissionPrefix: 'posts',
    searchable: ['title', 'slug'],

    table: () => [
      textColumn('title', t('res.posts.col.title'), { sortable: true }),
      badgeColumn('status', t('res.posts.col.status'), statusBadges()),
      dateColumn('publishedAt', t('res.posts.col.published'), { sortable: true }),
      dateColumn('createdAt', t('res.posts.col.created'), { sortable: true }),
      actionsColumn([
        defineAction({
          name: 'publish',
          label: t('res.posts.publish'),
          icon: 'badge-check',
          permission: 'posts.edit',
          visible: record => record.status !== 'published' && record.status !== 'scheduled',
          confirm: { title: t('res.posts.publishConfirm'), confirmLabel: t('res.posts.publish') },
          handler: async ({ record }) => {
            await $fetch(`/api/admin/posts/${record!.id}`, {
              method: 'PUT',
              body: { status: 'published' }
            })
            notify(t('notify.published'))
            emitAdminEvent('posts:refresh')
          }
        }),
        defineAction({
          name: 'view-public',
          label: t('res.posts.open'),
          icon: 'eye',
          permission: 'posts.view',
          visible: record => record.status === 'published',
          handler: async ({ record }) => {
            const post = await $fetch<Record<string, unknown>>(`/api/admin/posts/${record!.id}`)
            const translations = post.translations as Record<string, { slug?: string }>
            const primaryCode = post.primaryLocaleCode as string
            const slug = translations?.[primaryCode]?.slug ?? ''
            if (import.meta.client && slug) window.open(`/posts/${slug}`, '_blank', 'noopener')
          }
        })
      ])
    ],

    form: () => [
      section(t('res.posts.section.content'), [
        localizedInput('translations', t('res.posts.field.localized'), [
          textInput('title', t('res.posts.field.title'), { required: true, colSpan: 2 }),
          textarea('excerpt', t('res.posts.field.excerpt'), { rows: 2, colSpan: 2 }),
          richTextInput('content', t('res.posts.field.content'), { colSpan: 2 }),
          textInput('seoTitle', t('res.posts.field.seoTitle'), { colSpan: 2 }),
          textarea('seoDescription', t('res.posts.field.seoDescription'), { rows: 2, colSpan: 2 }),
          switchInput('noindex', t('res.posts.field.noindex'))
        ]),
        section(t('res.posts.section.metadata'), [
          grid(3, [
            textInput('alias', t('res.posts.field.alias'), {
              required: true,
              helpText: t('res.posts.help.alias')
            }),
            dateInput('scheduledAt', t('res.posts.field.scheduledAt'), {
              helpText: t('res.posts.help.scheduledAt')
            }),
            selectInput('commentStatus', t('res.posts.field.comments'), [
              { label: t('res.posts.comments.open'), value: 'open' },
              { label: t('res.posts.comments.closed'), value: 'closed' }
            ], { defaultValue: 'closed' })
          ]),
          grid(2, [
            mediaPicker('featuredMediaId', t('res.posts.field.featuredImage'), {
              helpText: t('res.posts.help.featuredImage')
            }),
            multiRelationInput('categoryIds', t('res.posts.field.categories'), {
              resource: 'categories',
              labelKey: 'name',
              creatable: true
            })
          ]),
          multiRelationInput('tagIds', t('res.posts.field.tags'), {
            resource: 'tags',
            labelKey: 'name',
            creatable: true
          }),
          grid(3, [
            selectInput('accessType', t('res.posts.field.access'), [
              { label: t('res.posts.access.public'), value: 'public' },
              { label: t('res.posts.access.members'), value: 'members' },
              { label: t('res.posts.access.paid'), value: 'paid' }
            ], { defaultValue: 'public' }),
            numberInput('paidPriceMinor', t('res.posts.field.paidPrice'), { min: 1, helpText: t('res.posts.help.paidPrice') }),
            selectInput('paidCurrency', t('res.posts.field.paidCurrency'), [
              { label: 'USD', value: 'USD' },
              { label: 'CNY', value: 'CNY' },
              { label: 'EUR', value: 'EUR' }
            ], { defaultValue: 'USD' })
          ])
        ])
      ])
    ],

    infolist: () => [
      textEntry('title', t('res.posts.field.title')),
      badgeEntry('status', t('res.posts.col.status'), statusBadges()),
      textEntry('primaryLocaleCode', t('res.posts.field.primaryLocale')),
      dateEntry('publishedAt', t('res.posts.col.published')),
      dateEntry('scheduledAt', t('res.posts.field.scheduledAt')),
      dateEntry('createdAt', t('res.posts.col.created'))
    ],

    bulkActions: [
      defineAction({
        name: 'bulk-publish',
        label: t('res.posts.bulkPublish'),
        icon: 'badge-check',
        permission: 'posts.edit',
        confirm: { title: t('res.posts.bulkPublishConfirm'), confirmLabel: t('res.posts.publish') },
        handler: async ({ ids }) => {
          await Promise.all((ids ?? []).map(id =>
            $fetch(`/api/admin/posts/${id}`, {
              method: 'PUT',
              body: { status: 'published' }
            })
          ))
          notify(`${ids!.length} posts published`)
          emitAdminEvent('posts:refresh')
        }
      })
    ]
  })
}
