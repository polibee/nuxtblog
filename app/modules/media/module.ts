import MediaResource from './admin/MediaResource'
import MediaFoldersResource from './admin/MediaFoldersResource'

export default defineModule(t => ({
  name: 'media',
  resources: [MediaResource(t), MediaFoldersResource(t)],
  navGroups: [{ label: t('res.media.group'), sort: 40 }]
}))
