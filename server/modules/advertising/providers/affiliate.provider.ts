import type { CreativeTranslation } from '../../../repositories/advertising.repository'
import type { AdPayload } from '../types'
import { assertSafeTarget, type AdProvider } from './ad.provider'

/* Affiliate ad: same visual shape as image ads but the target is an
   external affiliate URL; clicks are NOT rewritten through the local
   click endpoint. */

export const affiliateProvider: AdProvider = {
  key: 'affiliate',
  render(translation: CreativeTranslation): AdPayload {
    return {
      kind: 'affiliate',
      title: translation.title,
      content: translation.content ?? undefined,
      imageUrl: translation.imageUrl ?? undefined,
      targetUrl: assertSafeTarget(translation.targetUrl),
      buttonText: translation.buttonText ?? translation.title,
      altText: translation.altText ?? translation.title,
      creativeId: translation.creativeId
    }
  }
}
