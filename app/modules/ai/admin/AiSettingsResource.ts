import type { Translator } from '~/admin/core/types'
import AiSettingsPage from './AiSettingsPage.vue'

export default (t: Translator) => defineResource({
  name: 'ai',
  model: 'AiProvider',
  label: t('res.ai.label'),
  labelPlural: t('res.ai.label'),
  icon: 'sparkles',
  group: t('group.ai'),
  sort: 55,
  permissionPrefix: 'ai',
  pages: {
    list: AiSettingsPage
  },
  table: () => []
})
