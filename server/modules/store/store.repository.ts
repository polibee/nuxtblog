import { and, desc, eq, isNull, count, inArray, notInArray } from 'drizzle-orm'
import { getDb, isBlogDbReady } from '../../repositories/db.server'
import { locales } from '../../repositories/schema/locales'
import { media } from '../../repositories/schema/media'
import { products, productTranslations, productPrices, inventoryItems } from '../../repositories/schema/products'
import type { StoreProduct, StoreProductImage } from '#shared/types/store'

export type { StoreProduct }

/** resolve the optional product image to a public /media/:key URL;
    missing media rows degrade to null (frontend shows a placeholder) */
async function resolveImages(productIds: number[]): Promise<Map<number, StoreProductImage>> {
  const map = new Map<number, StoreProductImage>()
  if (productIds.length === 0) return map
  const rows = await getDb()
    .select({
      id: products.id,
      imageMediaId: products.imageMediaId,
      storageKey: media.storageKey,
      width: media.width,
      height: media.height
    })
    .from(products)
    .leftJoin(media, eq(products.imageMediaId, media.id))
    .where(inArray(products.id, productIds))
  for (const row of rows) {
    if (row.imageMediaId && row.storageKey) {
      map.set(row.id, {
        url: `/media/${row.storageKey}`,
        width: row.width,
        height: row.height
      })
    }
  }
  return map
}

export async function findPublishedProduct(alias: string, localeCode: string): Promise<StoreProduct | undefined> {
  if (!isBlogDbReady()) return undefined
  const db = getDb()
  const localeRows = await db.select({ id: locales.id, code: locales.code }).from(locales)
  const localeId = localeRows.find(l => l.code === localeCode)?.id

  const [product] = await db
    .select()
    .from(products)
    .where(and(eq(products.alias, alias), eq(products.status, 'published'), isNull(products.deletedAt)))
    .limit(1)
  if (!product) return undefined

  const [translation] = localeId
    ? await db
        .select()
        .from(productTranslations)
        .where(and(eq(productTranslations.productId, product.id), eq(productTranslations.localeId, localeId)))
        .limit(1)
    : []

  const [stock] = await db
    .select({ total: count() })
    .from(inventoryItems)
    .where(and(eq(inventoryItems.productId, product.id), eq(inventoryItems.status, 'available')))

  const prices = await db
    .select({ currency: productPrices.currency, amountMinor: productPrices.amountMinor })
    .from(productPrices)
    .where(and(eq(productPrices.productId, product.id), eq(productPrices.enabled, true)))

  const images = await resolveImages([product.id])

  return {
    id: product.id,
    alias: product.alias,
    productType: product.productType,
    deliveryStrategy: product.deliveryStrategy,
    status: product.status,
    maxQuantityPerOrder: product.maxQuantityPerOrder,
    title: translation?.title ?? product.alias,
    shortDescription: translation?.shortDescription ?? null,
    description: translation?.description ?? null,
    prices: prices.map(p => ({ currency: p.currency, amountMinor: p.amountMinor })),
    availableStock: stock?.total ?? 0,
    image: images.get(product.id) ?? null
  }
}

export async function listPublishedProducts(localeCode: string): Promise<StoreProduct[]> {
  if (!isBlogDbReady()) return []
  const db = getDb()
  const localeRows = await db.select({ id: locales.id, code: locales.code }).from(locales)
  const localeId = localeRows.find(l => l.code === localeCode)?.id
  if (!localeId) return []

  const rows = await db
    .select()
    .from(products)
    .where(and(eq(products.status, 'published'), isNull(products.deletedAt), notInArray(products.productType, ['membership', 'post_access'])))
    .orderBy(desc(products.createdAt))

  const visible: Array<typeof rows[number] & { title: string, shortDescription: string | null }> = []
  for (const product of rows) {
    const [translation] = await db
      .select()
      .from(productTranslations)
      .where(and(eq(productTranslations.productId, product.id), eq(productTranslations.localeId, localeId)))
      .limit(1)
    if (!translation) continue
    visible.push({ ...product, title: translation.title, shortDescription: translation.shortDescription })
  }

  const images = await resolveImages(visible.map(p => p.id))
  const result: StoreProduct[] = []
  for (const product of visible) {
    const [stock] = await db
      .select({ total: count() })
      .from(inventoryItems)
      .where(and(eq(inventoryItems.productId, product.id), eq(inventoryItems.status, 'available')))

    const prices = await db
      .select({ currency: productPrices.currency, amountMinor: productPrices.amountMinor })
      .from(productPrices)
      .where(and(eq(productPrices.productId, product.id), eq(productPrices.enabled, true)))

    result.push({
      id: product.id,
      alias: product.alias,
      productType: product.productType,
      deliveryStrategy: product.deliveryStrategy,
      status: product.status,
      maxQuantityPerOrder: product.maxQuantityPerOrder,
      title: product.title,
      shortDescription: product.shortDescription,
      prices: prices.map(p => ({ currency: p.currency, amountMinor: p.amountMinor })),
      availableStock: stock?.total ?? 0,
      image: images.get(product.id) ?? null
    })
  }
  return result
}
