import type { BadgeStyle, Translator } from '~/admin/core/types'

export default (t: Translator) => {
  const statusBadges = (): Record<string | number, BadgeStyle> => ({
    pending: { label: t('res.comments.status.pending'), variant: 'warning' },
    approved: { label: t('res.comments.status.approved'), variant: 'success' },
    spam: { label: t('res.comments.status.spam'), variant: 'destructive' }
  })

  return defineResource({
    name: 'comments',
    model: 'Comment',
    label: t('res.comments.label'),
    labelPlural: t('res.comments.plural'),
    icon: 'clipboard',
    group: t('group.content'),
    sort: 35,
    permissionPrefix: 'comments',
    searchable: ['authorName', 'content'],

    table: () => [
      textColumn('authorName', t('res.comments.col.author'), { sortable: true }),
      textColumn('content', t('res.comments.col.content')),
      badgeColumn('status', t('res.comments.col.status'), statusBadges()),
      textColumn('postTitle', t('res.comments.col.post')),
      dateColumn('createdAt', t('res.comments.col.date'), { sortable: true }),
      actionsColumn([
        defineAction({
          name: 'approve',
          label: t('res.comments.approve'),
          icon: 'badge-check',
          permission: 'comments.edit',
          visible: record => record.status !== 'approved',
          handler: async ({ record }) => {
            await $fetch(`/api/admin/comments/${record!.id}`, {
              method: 'PUT',
              body: { status: 'approved' }
            })
            notify(t('res.comments.approved'))
            emitAdminEvent('comments:refresh')
          }
        }),
        defineAction({
          name: 'spam',
          label: t('res.comments.spam'),
          icon: 'shield',
          permission: 'comments.edit',
          visible: record => record.status !== 'spam',
          handler: async ({ record }) => {
            await $fetch(`/api/admin/comments/${record!.id}`, {
              method: 'PUT',
              body: { status: 'spam' }
            })
            notify(t('res.comments.markedSpam'))
            emitAdminEvent('comments:refresh')
          }
        })
      ])
    ],

    infolist: () => [
      textEntry('authorName', t('res.comments.col.author')),
      textEntry('authorEmail', t('res.comments.field.email')),
      badgeEntry('status', t('res.comments.col.status'), statusBadges()),
      textEntry('content', t('res.comments.col.content')),
      textEntry('postTitle', t('res.comments.col.post')),
      datetimeEntry('createdAt', t('res.comments.col.date'))
    ]
  })
}
