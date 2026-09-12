import type { Translator } from '~/admin/core/types'
import { localizedInput, relationInput } from '~/admin/schemas/builders/fields'
import MediaLibraryPage from './MediaLibraryPage.vue'

export default (t: Translator) => defineResource({
  name: 'media',
  model: 'Media',
  label: t('res.media.label'),
  labelPlural: t('res.media.plural'),
  icon: 'image',
  group: t('res.media.group'),
  sort: 40,
  permissionPrefix: 'media',
  searchable: ['filename'],
  // multipart create goes to the dedicated upload endpoint
  endpoints: { create: '/api/admin/media/upload' },
  pages: {
    list: MediaLibraryPage
  },

  table: () => [
    imageColumn('url', ''),
    textColumn('filename', t('res.media.col.filename'), { sortable: true }),
    textColumn('mime', t('res.media.col.type')),
    numberColumn('size', t('res.media.col.size')),
    dateColumn('createdAt', t('res.media.col.uploaded'), { sortable: true }),
    actionsColumn([
      defineAction({
        name: 'edit-info',
        label: t('res.media.editInfo'),
        icon: 'pencil',
        permission: 'media.edit',
        form: () => [
          section(t('res.media.editInfo'), [
            localizedInput('translations', t('res.media.field.localized'), [
              textInput('alt', t('res.media.field.alt')),
              textInput('caption', t('res.media.field.caption'))
            ]),
            relationInput('folderId', t('res.mediaFolders.col.name'), {
              resource: 'media/folders',
              labelKey: 'name'
            })
          ])
        ],
        handler: async ({ record, values }) => {
          await $fetch(`/api/admin/media/${record!.id}`, {
            method: 'PUT',
            body: { translations: values!.translations ?? {} }
          })
          notify(`${record!.filename} updated`)
          emitAdminEvent('media:refresh')
        }
      }),
      defineAction({
        name: 'preview',
        label: t('res.media.open'),
        icon: 'eye',
        permission: 'media.view',
        handler: async ({ record }) => {
          if (import.meta.client) window.open(String(record!.url), '_blank', 'noopener')
        }
      })
    ])
  ],

  form: () => [
    section(t('res.media.section.upload'), [
      fileInput('file', t('res.media.field.file'), { required: true, helpText: t('res.media.fileHint') })
    ])
  ],

  infolist: () => [
    textEntry('filename', t('res.media.col.filename')),
    textEntry('mime', t('res.media.col.type')),
    textEntry('size', t('res.media.col.size')),
    datetimeEntry('createdAt', t('res.media.col.uploaded')),
    linkEntry('url', 'URL')
  ]
})
