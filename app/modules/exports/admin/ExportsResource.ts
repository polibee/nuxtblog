import type { Translator } from '~/admin/core/types'
import ExportsManagerPage from './ExportsManagerPage.vue'

export default (t: Translator) => defineResource({
  name: 'exports',
  model: 'ExportJob',
  label: t('res.eximp.title'),
  labelPlural: t('res.eximp.title'),
  icon: 'download',
  group: t('res.store.group'),
  sort: 36,
  permissionPrefix: 'store.exports',
  pages: {
    list: ExportsManagerPage
  },
  table: () => []
})
