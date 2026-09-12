import type { Translator } from '~/admin/core/types'
import { textInput } from '~/admin/schemas/builders/fields'

export default (t: Translator) => defineResource({
  name: 'media/folders',
  model: 'MediaFolder',
  label: t('res.mediaFolders.label'),
  labelPlural: t('res.mediaFolders.label'),
  icon: 'folder',
  group: t('res.media.group'),
  sort: 41,
  permissionPrefix: 'media',

  table: () => [
    textColumn('name', t('res.mediaFolders.col.name'), { sortable: true }),
    dateColumn('createdAt', t('res.media.col.uploaded'))
  ],

  form: () => [
    section(t('res.mediaFolders.label'), [
      textInput('name', t('res.mediaFolders.col.name'), { required: true })
    ])
  ],

  infolist: () => [
    textEntry('name', t('res.mediaFolders.col.name'))
  ]
})
