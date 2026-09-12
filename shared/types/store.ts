/* Public storefront product shape (shared by server repository and pages). */

export interface StoreProductImage {
  url: string
  width: number | null
  height: number | null
}

export interface StoreProduct {
  id: number
  alias: string
  productType: string
  deliveryStrategy: string
  status: string
  maxQuantityPerOrder: number
  title: string
  shortDescription: string | null
  description?: string | null
  prices: Array<{ currency: string, amountMinor: number }>
  availableStock: number
  image?: StoreProductImage | null
}
