import type { Translator } from '~/admin/core/types'
import AiUsagePage from './AiUsagePage.vue'

export default (t: Translator) => defineResource({
  name: 'ai-usage',
  model: 'AiUsage',
  label: t('res.ai.analytics'),
  labelPlural: t('res.ai.analytics'),
  icon: 'activity',
  group: t('group.ai'),
  sort: 56,
  permissionPrefix: 'ai',
  pages: { list: AiUsagePage },
  table: () => []
})
