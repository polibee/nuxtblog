import type { CreativeTranslation } from '../../../repositories/advertising.repository'
import type { AdPayload } from '../types'

/* Advertising Provider contract (impl doc §5): transform a creative +
   locale translation into a structured payload the Vue renderer can draw.
   Providers are registered in provider-registry.ts and are swappable. */

export interface AdProvider {
  key: 'image' | 'affiliate' | 'adsense'
  render(translation: CreativeTranslation): AdPayload
}

export function assertSafeTarget(url: string | null | undefined): string | undefined {
  if (!url) return undefined
  const v = url.trim()
  if (v.startsWith('/') && !v.startsWith('//')) return v
  if (/^https:\/\//i.test(v)) return v
  return undefined
}
