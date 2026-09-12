import type { Translator } from '~/admin/core/types'
import AiChatPage from './AiChatPage.vue'

/* P30 AI Assistant chat: tool-calling site analysis, read-only. */

export default (t: Translator) => defineResource({
  name: 'ai-assistant',
  model: 'AiConversation',
  label: t('res.aichat.label'),
  labelPlural: t('res.aichat.label'),
  icon: 'sparkles',
  group: t('group.ai'),
  sort: 56,
  permissionPrefix: 'ai',
  pages: {
    list: AiChatPage
  },
  table: () => []
})
