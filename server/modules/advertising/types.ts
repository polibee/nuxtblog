/* AdPayload: structured result consumed by the Vue renderer.
   Lives here so decision.service, providers and the service share one
   definition without circular imports. */

export interface AdPayload {
  kind: 'image' | 'affiliate' | 'adsense' | 'NO_AD'
  title?: string
  content?: string
  imageUrl?: string
  targetUrl?: string
  buttonText?: string
  altText?: string
  client?: string
  slotId?: string
  creativeId?: number
  reason?: string
}

export interface Viewer {
  id: number
  email: string
}
