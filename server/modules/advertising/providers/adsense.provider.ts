import type { CreativeTranslation } from '../../../repositories/advertising.repository'
import type { AdPayload } from '../types'
import type { AdProvider } from './ad.provider'

/* Google AdSense slot: the admin pastes the full <ins> config values
   (client + slot id) into the creative content field as
   { "client": "ca-pub-...", "slot": "1234567890" } JSON. */

export const adsenseProvider: AdProvider = {
  key: 'adsense',
  render(translation: CreativeTranslation): AdPayload {
    let client = ''
    let slotId = ''
    try {
      const parsed = JSON.parse(translation.content ?? '{}') as { client?: string, slot?: string }
      client = String(parsed.client ?? '')
      slotId = String(parsed.slot ?? '')
    } catch {
      // malformed config renders nothing client-side
    }
    return {
      kind: 'adsense',
      title: translation.title,
      client,
      slotId,
      creativeId: translation.creativeId
    }
  }
}
