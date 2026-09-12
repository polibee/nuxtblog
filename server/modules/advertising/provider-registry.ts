import type { CreativeTranslation } from '../../repositories/advertising.repository'
import type { AdPayload } from './types'
import type { AdProvider } from './providers/ad.provider'
import { affiliateProvider } from './providers/affiliate.provider'
import { adsenseProvider } from './providers/adsense.provider'
import { imageProvider } from './providers/image.provider'

/* Provider Registry (impl doc §5): swap/add providers here only. */

export const providerRegistry: Record<string, AdProvider> = {
  image: imageProvider,
  affiliate: affiliateProvider,
  adsense: adsenseProvider
}

export function renderWith(providerKey: string, translation: CreativeTranslation): AdPayload {
  const provider = providerRegistry[providerKey]
  if (!provider) {
    return { kind: 'NO_AD', reason: 'unknown_provider' }
  }
  return provider.render(translation)
}

export type { CreativeTranslation }
