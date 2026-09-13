import type { BadgeStyle, Translator } from '~/admin/core/types'

export default (t: Translator) => {
  const statusBadges = (): Record<string | number, BadgeStyle> => ({
    pending: { label: t('comments.status.pending'), variant: 'warning' },
    approved: { label: t('comments.status.approved'), variant: 'success' },
    spam: { label: t('comments.status.spam'), variant: 'destructive' }
  })

  return defineResource({
    name: 'comments',
    model: 'Comment',
    label: t('comments.label'),
    labelPlural: t('comments.plural'),
    icon: 'clipboard',
    group: t('group.content'),
    sort: 35,
    permissionPrefix: 'comments',
    searchable: ['authorName', 'content'],

    table: () => [
      textColumn('authorName', t('comments.fields.author'), { sortable: true }),
      textColumn('content', t('comments.fields.content')),
      badgeColumn('status', t('comments.fields.status'), statusBadges()),
      textColumn('postTitle', t('comments.fields.post')),
      dateColumn('createdAt', t('comments.fields.date'), { sortable: true }),
      actionsColumn([
        defineAction({
          name: 'approve',
          label: t('comments.actions.approve'),
          icon: 'badge-check',
          permission: 'comments.edit',
          visible: record => record.status !== 'approved',
          handler: async ({ record }) => {
            await $fetch(`/api/admin/comments/${record!.id}`, {
              method: 'PUT',
              body: { status: 'approved' }
            })
            notify(t('comments.messages.approved'))
            emitAdminEvent('comments:refresh')
          }
        }),
        defineAction({
          name: 'spam',
          label: t('comments.actions.spam'),
          icon: 'shield',
          permission: 'comments.edit',
          visible: record => record.status !== 'spam',
          handler: async ({ record }) => {
            await $fetch(`/api/admin/comments/${record!.id}`, {
              method: 'PUT',
              body: { status: 'spam' }
            })
            notify(t('comments.messages.markedSpam'))
            emitAdminEvent('comments:refresh')
          }
        })
      ])
    ],

    infolist: () => [
      textEntry('authorName', t('comments.fields.author')),
      textEntry('authorEmail', t('comments.fields.email')),
      badgeEntry('status', t('comments.fields.status'), statusBadges()),
      textEntry('content', t('comments.fields.content')),
      textEntry('postTitle', t('comments.fields.post')),
      datetimeEntry('createdAt', t('comments.fields.date'))
    ]
  })
}
