import type { Translator } from '~/admin/core/types'
import { textInput, switchInput } from '~/admin/schemas/builders/fields'

export default (t: Translator) => {
  return defineResource({
    name: 'advertising/slots',
    model: 'AdSlot',
    label: t('res.adslots.label'),
    labelPlural: t('res.adslots.label'),
    icon: 'megaphone',
    group: t('res.advertising.group'),
    sort: 34,
    permissionPrefix: 'advertising',
    searchable: ['name'],

    table: () => [
      textColumn('key', t('res.adslots.col.key'), { sortable: true }),
      textColumn('name', t('res.adslots.col.name')),
      booleanColumn('enabled', t('res.sidebar.col.enabled')),
      dateColumn('createdAt', t('res.posts.col.created'))
    ],

    form: () => [
      section(t('res.adslots.label'), [
        grid(2, [
          textInput('key', t('res.adslots.col.key'), {
            required: true,
            helpText: t('res.adslots.help.key')
          }),
          textInput('name', t('res.adslots.col.name'), { required: true })
        ]),
        switchInput('enabled', t('res.sidebar.field.enabled'), { defaultValue: true })
      ])
    ],

    infolist: () => [
      textEntry('key', t('res.adslots.col.key')),
      textEntry('name', t('res.adslots.col.name')),
      booleanEntry('enabled', t('res.sidebar.col.enabled'))
    ]
  })
}
