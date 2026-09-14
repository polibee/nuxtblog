import type { BadgeStyle, Translator } from '~/admin/core/types'

export default (t: Translator) => {
  const statusBadges = (): Record<string | number, BadgeStyle> => ({
    active: { label: t('status.active'), variant: 'success' },
    inactive: { label: t('status.inactive'), variant: 'secondary' }
  })

  const roleBadges = (): Record<string | number, BadgeStyle> => ({
    admin: { label: t('res.users.role.admin'), variant: 'default' },
    editor: { label: t('res.users.role.editor'), variant: 'warning' },
    viewer: { label: t('res.users.role.viewer'), variant: 'secondary' }
  })

  const roleOptions = [
    { label: t('res.users.role.admin'), value: 'admin' },
    { label: t('res.users.role.editor'), value: 'editor' },
    { label: t('res.users.role.viewer'), value: 'viewer' }
  ]

  const statusOptions = [
    { label: t('status.active'), value: 'active' },
    { label: t('status.inactive'), value: 'inactive' }
  ]

  return defineResource({
    name: 'users',
    model: 'User',
    label: t('res.users.label'),
    labelPlural: t('res.users.plural'),
    icon: 'users',
    group: t('res.users.group'),
    sort: 10,
    searchable: ['name', 'email'],
    permissionPrefix: 'users',

    table: () => [
      textColumn('name', t('res.users.col.name'), { sortable: true }),
      textColumn('email', t('res.users.col.email')),
      badgeColumn('role', t('res.users.col.role'), roleBadges()),
      badgeColumn('status', t('res.users.col.status'), statusBadges()),
      dateColumn('createdAt', t('res.users.col.joined'), { sortable: true }),
      actionsColumn([
        defineAction({
          name: 'manage-badge',
          label: t('res.users.badges'),
          icon: 'badge-check',
          permission: 'users.edit',
          form: () => [
            selectInput('badgeKey', t('res.users.badge'), [
              { label: t('res.users.badge.member'), value: 'member' },
              { label: t('res.users.badge.vip'), value: 'vip' },
              { label: t('res.users.badge.supporter'), value: 'supporter' }
            ], { required: true }),
            selectInput('badgeAction', t('res.users.badgeAction'), [
              { label: t('res.users.badgeGrant'), value: 'grant' },
              { label: t('res.users.badgeRevoke'), value: 'revoke' }
            ], { required: true })
          ],
          handler: async ({ record, values }) => {
            await $fetch(`/api/admin/users/${record!.id}`, { method: 'PUT', body: values })
            notify(t('toast.updated', { label: t('res.users.badges') }))
            emitAdminEvent('users:refresh')
          }
        })
      ])
    ],

    form: () => [
      section(t('res.users.section.account'), [
        grid(2, [
          textInput('name', t('res.users.field.name'), { required: true, placeholder: 'Jane Doe' }),
          emailInput('email', t('res.users.field.email'), { required: true, placeholder: 'jane@example.com' })
        ]),
        grid(2, [
          selectInput('role', t('res.users.field.role'), roleOptions, { defaultValue: 'viewer' }),
          selectInput('status', t('res.users.field.status'), statusOptions, { defaultValue: 'active' })
        ]),
        passwordInput('password', t('res.users.field.password'), {
          helpText: t('res.users.field.passwordHint'),
          placeholder: '••••••••',
          colSpan: 2
        })
      ])
    ],

    infolist: () => [
      textEntry('name', t('res.users.field.name')),
      textEntry('email', t('res.users.field.email')),
      badgeEntry('role', t('res.users.col.role'), roleBadges()),
      badgeEntry('status', t('res.users.col.status'), statusBadges()),
      dateEntry('createdAt', t('res.users.col.joined'))
    ]
  })
}
