import { createError } from 'h3'
import { z } from 'zod'
import { eq, and, isNull, desc, sql, inArray } from 'drizzle-orm'
import { getDb, isBlogDbReady } from '../../repositories/db.server'
import { listLocales } from '../../repositories/locale.repository'
import { locales } from '../../repositories/schema/locales'
import { media } from '../../repositories/schema/media'
import { products, productTranslations, productPrices, inventoryItems } from '../../repositories/schema/products'
import { ensureAlias } from '#shared/schemas/post'
import { listPublishedProducts, type StoreProduct } from './store.repository'
import { bumpAiDomains } from '../ai/optimization/invalidate'

/* Store commerce service (P10): product CRUD, inventory import,
   order creation with server-side pricing and inventory reservation. */

export type { StoreProduct }

export const productInputSchema = z
  .object({
    alias: z.string().trim().toLowerCase().max(120).optional(),
    productType: z.enum(['card_key', 'gift_card', 'account', 'invite_code', 'other']).optional(),
    deliveryStrategy: z.enum(['one_time_reveal', 'structured_reveal', 'link']).optional(),
    status: z.enum(['draft', 'published', 'off_shelf', 'archived']).optional(),
    maxQuantityPerOrder: z.number().int().min(1).max(100).optional(),
    imageMediaId: z.number().int().positive().nullable().optional(),
    prices: z.array(z.object({
      currency: z.string().length(3).toUpperCase(),
      amountMinor: z.number().int().min(0)
    })).optional(),
    translations: z.record(z.string(), z.object({
      title: z.string().trim().min(1).max(255),
      shortDescription: z.string().max(500).optional(),
      description: z.string().optional()
    })).optional()
  })
  .strict()

export type ProductInput = z.infer<typeof productInputSchema>

export async function listProductsForAdmin(): Promise<Array<Omit<StoreProduct, 'image'> & { id: number, status: string, image: string | null }>> {
  if (!isBlogDbReady()) return []
  const db = getDb()
  const localeRows = await db.select().from(locales)
  const defaultLocale = localeRows.find(l => l.isDefault) ?? localeRows[0]
  if (!defaultLocale) return []

  const rows = await db
    .select()
    .from(products)
    .where(isNull(products.deletedAt))
    .orderBy(desc(products.createdAt))

  // image column renders a URL string; missing media → null (placeholder in UI)
  const imageUrls = new Map<number, string | null>()
  const mediaIds = rows.map(r => r.imageMediaId).filter((v): v is number => typeof v === 'number')
  if (mediaIds.length > 0) {
    const mediaRows = await db.select({ id: media.id, storageKey: media.storageKey }).from(media).where(inArray(media.id, mediaIds))
    const byId = new Map(mediaRows.map(m => [m.id, m.storageKey]))
    for (const row of rows) {
      const key = row.imageMediaId ? byId.get(row.imageMediaId) : undefined
      imageUrls.set(row.id, key ? `/media/${key}` : null)
    }
  }

  const result: Array<Omit<StoreProduct, 'image'> & { id: number, status: string, image: string | null }> = []
  for (const product of rows) {
    const [translation] = await db
      .select()
      .from(productTranslations)
      .where(and(eq(productTranslations.productId, product.id), eq(productTranslations.localeId, product.primaryLocaleId)))
      .limit(1)

    const [stock] = await db
      .select({ total: sql<number>`count(*)` })
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
      prices: prices.map(p => ({ currency: p.currency, amountMinor: p.amountMinor })),
      availableStock: stock?.total ?? 0,
      title: translation?.title ?? product.alias,
      shortDescription: translation?.shortDescription ?? null,
      image: imageUrls.get(product.id) ?? null
    })
  }
  return result
}

export async function createProduct(body: unknown, userId: number): Promise<StoreProduct> {
  if (!isBlogDbReady()) {
    throw createError({ statusCode: 503, statusMessage: 'Database unavailable' })
  }
  const result = productInputSchema.safeParse(body)
  if (!result.success) {
    throw createError({ statusCode: 422, statusMessage: result.error.issues[0]?.message ?? 'Invalid input' })
  }
  const input = result.data

  const locales = await listLocales()
  const defaultLocale = locales.find(l => l.isDefault) ?? locales[0]
  if (!defaultLocale) throw createError({ statusCode: 503, statusMessage: 'No default locale' })

  const primaryTitle = Object.values(input.translations ?? {})[0]?.title ?? ''
  const alias = ensureAlias(primaryTitle, input.alias)
  const existing = await getDb().select().from(products).where(eq(products.alias, alias)).limit(1)
  if (existing.length > 0) {
    throw createError({ statusCode: 409, statusMessage: `Alias "${alias}" already exists` })
  }

  const [inserted] = await getDb().insert(products).values({
    alias,
    productType: input.productType ?? 'card_key',
    deliveryStrategy: input.deliveryStrategy ?? 'one_time_reveal',
    status: input.status ?? 'draft',
    maxQuantityPerOrder: input.maxQuantityPerOrder ?? 1,
    imageMediaId: input.imageMediaId ?? null,
    primaryLocaleId: defaultLocale.id,
    createdBy: userId
  })
  if (!inserted) throw createError({ statusCode: 500, statusMessage: 'Product insert failed' })

  const productId = inserted.insertId
  for (const [code, fields] of Object.entries(input.translations ?? {})) {
    const localeId = locales.find(l => l.code === code)?.id
    if (!localeId) continue
    await getDb().insert(productTranslations).values({
      productId, localeId, title: fields.title,
      shortDescription: fields.shortDescription ?? null,
      description: fields.description ?? null
    })
  }
  for (const price of input.prices ?? []) {
    await getDb().insert(productPrices).values({
      productId, currency: price.currency, amountMinor: price.amountMinor
    })
  }

  await bumpAiDomains(['products'])
  return { ...await getProductByAlias(alias), id: productId }
}

export async function getProductByAlias(alias: string): Promise<StoreProduct> {
  const db = getDb()
  const [product] = await db.select().from(products).where(and(eq(products.alias, alias), isNull(products.deletedAt))).limit(1)
  if (!product) throw createError({ statusCode: 404, statusMessage: 'Product not found' })
  const [translation] = await db.select().from(productTranslations).where(and(eq(productTranslations.productId, product.id), eq(productTranslations.localeId, product.primaryLocaleId))).limit(1)
  return {
    id: product.id,
    alias: product.alias,
    productType: product.productType,
    deliveryStrategy: product.deliveryStrategy,
    status: product.status,
    maxQuantityPerOrder: product.maxQuantityPerOrder,
    title: translation?.title ?? product.alias,
    shortDescription: translation?.shortDescription ?? null,
    prices: [],
    availableStock: 0
  }
}

/** admin product detail: raw fields + translations map + prices */
export async function getProductForAdmin(id: number): Promise<{
  id: number
  alias: string
  productType: string
  deliveryStrategy: string
  status: string
  maxQuantityPerOrder: number
  imageMediaId: number | null
  translations: Record<string, { title: string, shortDescription: string | null, description: string | null }>
  prices: Array<{ currency: string, amountMinor: number }>
} | undefined> {
  if (!isBlogDbReady()) return undefined
  const db = getDb()
  const [product] = await db.select().from(products).where(and(eq(products.id, id), isNull(products.deletedAt))).limit(1)
  if (!product) return undefined
  const localeRows = await db.select().from(locales)
  const translations = await db.select().from(productTranslations).where(eq(productTranslations.productId, id))
  const prices = await db.select().from(productPrices).where(eq(productPrices.productId, id))
  const translationsMap: Record<string, { title: string, shortDescription: string | null, description: string | null }> = {}
  for (const t of translations) {
    const code = localeRows.find(l => l.id === t.localeId)?.code
    if (code) translationsMap[code] = { title: t.title, shortDescription: t.shortDescription, description: t.description }
  }
  return {
    id: product.id,
    alias: product.alias,
    productType: product.productType,
    deliveryStrategy: product.deliveryStrategy,
    status: product.status,
    maxQuantityPerOrder: product.maxQuantityPerOrder,
    imageMediaId: product.imageMediaId,
    translations: translationsMap,
    prices: prices.map(p => ({ currency: p.currency, amountMinor: p.amountMinor }))
  }
}

/** admin product update: scalar fields + optional translations/prices replace */
export async function updateProduct(id: number, body: unknown): Promise<void> {
  if (!isBlogDbReady()) {
    throw createError({ statusCode: 503, statusMessage: 'Database unavailable' })
  }
  const [product] = await getDb().select().from(products).where(and(eq(products.id, id), isNull(products.deletedAt))).limit(1)
  if (!product) throw createError({ statusCode: 404, statusMessage: 'Product not found' })
  const result = productInputSchema.safeParse(body)
  if (!result.success) {
    throw createError({ statusCode: 422, statusMessage: result.error.issues[0]?.message ?? 'Invalid input' })
  }
  const input = result.data

  const values: Partial<typeof products.$inferInsert> = {}
  if (input.productType !== undefined) values.productType = input.productType
  if (input.deliveryStrategy !== undefined) values.deliveryStrategy = input.deliveryStrategy
  if (input.status !== undefined) values.status = input.status
  if (input.maxQuantityPerOrder !== undefined) values.maxQuantityPerOrder = input.maxQuantityPerOrder
  if (input.imageMediaId !== undefined) values.imageMediaId = input.imageMediaId
  if (Object.keys(values).length > 0) {
    await getDb().update(products).set(values).where(eq(products.id, id))
  }

  const locales = await listLocales()
  if (input.translations !== undefined) {
    await getDb().delete(productTranslations).where(eq(productTranslations.productId, id))
    for (const [code, fields] of Object.entries(input.translations)) {
      const localeId = locales.find(l => l.code === code)?.id
      if (!localeId) continue
      await getDb().insert(productTranslations).values({
        productId: id, localeId, title: fields.title,
        shortDescription: fields.shortDescription ?? null,
        description: fields.description ?? null
      })
    }
  }
  if (input.prices !== undefined) {
    await getDb().delete(productPrices).where(eq(productPrices.productId, id))
    for (const price of input.prices) {
      await getDb().insert(productPrices).values({ productId: id, currency: price.currency, amountMinor: price.amountMinor })
    }
  }
  await bumpAiDomains(['products'])
}

export { listPublishedProducts }
