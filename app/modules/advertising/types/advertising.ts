/* P17 advertising type contracts shared between app and server. */

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

export interface ResolveRequest {
  slots: string[]
  path: string
  locale?: string
}

export interface ResolveBatchResponse {
  results: Record<string, AdPayload | null>
}

export interface ResolvedCreativeItem {
  title: string
  alias: string
}
