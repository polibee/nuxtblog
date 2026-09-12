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

    table: () => [
      textColumn('name', t('res.users.col.name'), { sortable: true }),
      textColumn('email', t('res.users.col.email')),
      badgeColumn('role', t('res.users.col.role'), roleBadges()),
      badgeColumn('status', t('res.users.col.status'), statusBadges()),
      dateColumn('createdAt', t('res.users.col.joined'), { sortable: true })
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
