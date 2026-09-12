import type { CreativeTranslation } from '../../../repositories/advertising.repository'
import type { AdPayload } from '../types'
import { assertSafeTarget, type AdProvider } from './ad.provider'

/* Self-hosted image ad: title + image + optional button + target URL. */

export const imageProvider: AdProvider = {
  key: 'image',
  render(translation: CreativeTranslation): AdPayload {
    return {
      kind: 'image',
      title: translation.title,
      content: translation.content ?? undefined,
      imageUrl: translation.imageUrl ?? undefined,
      targetUrl: assertSafeTarget(translation.targetUrl),
      buttonText: translation.buttonText ?? undefined,
      altText: translation.altText ?? translation.title,
      creativeId: translation.creativeId
    }
  }
}
