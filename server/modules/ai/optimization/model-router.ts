/* P36 Model Router (缓存优化 §19/20 + 设置.txt §31/32): features declare
   a quality tier; the tier maps to a settings key (ai.model.*) chosen on
   the Settings → AI page. Empty setting = provider default. Settings →
   AI only ever selects purpose-named models — never raw provider strings
   chosen per feature. */

import { getSettingValue } from '../../settings/settings.service'
import type { AiProviderRuntime } from '../ai.service'

export type ModelClass = 'fast' | 'standard' | 'deep' | 'vision'

/* cheap: classify/summarize/route; standard: editor/chat/analysis;
   deep: whole-site heavy analysis; vision: screenshots only (A4) */
export function modelClassForFeature(feature: string): ModelClass {
  if (feature.startsWith('editor.')) return 'standard'
  if (feature.startsWith('chat.')) return 'standard'
  if (feature.startsWith('digest.')) return 'fast'
  if (feature.startsWith('report.')) return 'deep'
  if (feature.startsWith('vision.')) return 'vision'
  return 'standard'
}

const SETTINGS_KEY_BY_CLASS: Record<ModelClass, string> = {
  fast: 'ai.model.writing',
  standard: 'ai.model.analysis',
  deep: 'ai.model.analysis',
  vision: 'ai.model.vision'
}

export async function resolveModel(provider: AiProviderRuntime, modelClass: ModelClass): Promise<string> {
  const configured = String(await getSettingValue(SETTINGS_KEY_BY_CLASS[modelClass], '')).trim()
  return configured || provider.defaultModel
}
