import type { Translator, SchemaNode } from '~/admin/core/types'
import SettingsGroupedPage from './SettingsGroupedPage.vue'
import SettingsWorkspacePage from './SettingsWorkspacePage.vue'

const GROUP_OPTIONS = ['General', 'Blog', 'Email', 'Cache', 'Security', 'Storage', 'Plugin']
const TYPE_OPTIONS = [
  { label: 'String', value: 'string' },
  { label: 'Text', value: 'text' },
  { label: 'Number', value: 'number' },
  { label: 'Boolean', value: 'boolean' },
  { label: 'Secret', value: 'secret' }
]

/** per-type edit form for the "Edit Value" row action */
function valueField(type: string, current: unknown): SchemaNode {
  switch (type) {
    case 'text':
      return textarea('value', 'Value', { rows: 4 })
    case 'number':
      return numberInput('value', 'Value')
    case 'boolean':
      return switchInput('value', 'Value', { defaultValue: Boolean(current) })
    case 'secret':
      return passwordInput('value', 'Value', { placeholder: 'Leave empty to keep current secret' })
    default:
      return textInput('value', 'Value', { required: true })
  }
}

/** P34 (docs/设置.txt): the schema-driven workspace is the Settings UI;
    the legacy key/value panel moves to /admin/settings/raw (developer
    only, Advanced §40 — full Raw Editor gating lands in S7). */
export default (t: Translator) => defineResource({
  name: 'settings',
  model: 'Setting',
  label: t('res.settings.label'),
  labelPlural: t('res.settings.plural'),
  icon: 'settings',
  group: t('nav.system'),
  sort: 97,
  permissionPrefix: 'settings',
  searchable: ['key', 'group'],
  pages: {
    list: SettingsWorkspacePage,
    view: SettingsWorkspacePage,
    raw: SettingsGroupedPage
  },

  table: () => [
    textColumn('key', 'Key'),
    badgeColumn('group', 'Group', Object.fromEntries(
      GROUP_OPTIONS.map(g => [g, { label: g, variant: 'secondary' }])
    )),
    textColumn('type', 'Type'),
    booleanColumn('public', 'Public'),
    textColumn('value', 'Value'),
    actionsColumn([
      defineAction({
        name: 'edit-typed',
        label: 'Edit Value',
        icon: 'pencil',
        permission: 'settings.edit',
        form: (ctx) => {
          const record = ctx.record ?? {}
          const type = String(record.type ?? 'string')
          return [
            section(String(record.key ?? 'Setting'), [
              valueField(type, record.value)
            ])
          ]
        },
        handler: async ({ record, values }) => {
          const current = record!.value
          let value: string | number | boolean = String(values!.value ?? '')
          if (record!.type === 'number') value = Number(value)
          if (record!.type === 'boolean') value = Boolean(values!.value)
          if (record!.type === 'secret' && !String(values!.value)) value = String(current ?? '')
          await $fetch(`/api/admin/settings/${record!.id}`, {
            method: 'PUT',
            body: { value }
          })
          notify(`${record!.key} updated`)
          emitAdminEvent('settings:refresh')
        }
      })
    ])
  ],

  form: () => [
    section('Setting', [
      grid(2, [
        textInput('key', 'Key', { required: true, placeholder: 'SITE_NAME', colSpan: 2 }),
        textInput('group', 'Group', { required: true, defaultValue: 'General' }),
        selectInput('type', 'Type', TYPE_OPTIONS, { defaultValue: 'string' }),
        switchInput('public', 'Public', { defaultValue: false }),
        textInput('value', 'Value', { colSpan: 2 }),
        textarea('description', 'Description', { rows: 2, colSpan: 2 })
      ])
    ])
  ],

  infolist: () => [
    textEntry('key', 'Key'),
    textEntry('group', 'Group'),
    textEntry('type', 'Type'),
    booleanEntry('public', 'Public'),
    textEntry('value', 'Value'),
    textEntry('description', 'Description')
  ]
})
