import AiSettingsResource from './admin/AiSettingsResource'
import AiChatResource from './admin/AiChatResource'
import AiPresetsResource from './admin/AiPresetsResource'
import AiUsageResource from './admin/AiUsageResource'

export default defineModule(t => ({
  name: 'ai',
  resources: [AiChatResource(t), AiUsageResource(t), AiPresetsResource(t), AiSettingsResource(t)],
  navGroups: [{ label: t('group.ai'), sort: 55 }]
}))
