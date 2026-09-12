import type { Translator } from '~/admin/core/types'
import PromptsManagerPage from './PromptsManagerPage.vue'

/* C3 preset manager: built-in + custom AI work modes. */

export default (t: Translator) => defineResource({
  name: 'ai-presets',
  model: 'AiAssistantPreset',
  label: t('res.aipreset.label'),
  labelPlural: t('res.aipreset.label'),
  icon: 'sparkles',
  group: t('group.ai'),
  sort: 57,
  permissionPrefix: 'ai',
  pages: {
    list: PromptsManagerPage
  },
  table: () => []
})
