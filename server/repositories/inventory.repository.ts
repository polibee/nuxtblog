import { and, asc, eq, lt, sql } from 'drizzle-orm'
import { getDb } from './db.server'
import { inventoryBatches, inventoryItems } from './schema/products'
import { decryptSecret, encryptSecret, fingerprint } from '../utils/encryption'
import { createError } from 'h3'

/* Inventory management (commerce doc §5): import, reserve, release,
   allocate, deliver, revoke. All secret data is AES-256-GCM encrypted.
   State machine: available → reserved → allocated → delivered
                               ↕ reserved (release)
                              revoked / expired */

export interface InventoryItemRow {
  id: number
  productId: number
  batchId: number
  status: string
  secretCiphertext: string
  secretNonce: string
  secretAuthTag: string
  fingerprint: string
  reservedUntil: Date | null
  orderId: number | null
  deliveredAt: Date | null
}

export interface InventorySummary {
  productId: number
  total: number
  available: number
  reserved: number
  allocated: number
  delivered: number
  revoked: number
}

export async function getInventorySummary(productId: number): Promise<InventorySummary> {
  const rows = await getDb()
    .select({ status: inventoryItems.status, total: sql<number>`count(*)` })
    .from(inventoryItems)
    .where(eq(inventoryItems.productId, productId))
    .groupBy(inventoryItems.status)

  const summary: InventorySummary = {
    productId, total: 0, available: 0, reserved: 0,
    allocated: 0, delivered: 0, revoked: 0
  }
  for (const row of rows) {
    const n = Number(row.total)
    summary.total += n
    if (row.status === 'available') summary.available = n
    else if (row.status === 'reserved') summary.reserved = n
    else if (row.status === 'allocated') summary.allocated = n
    else if (row.status === 'delivered') summary.delivered = n
    else if (row.status === 'revoked') summary.revoked = n
  }
  return summary
}

export interface ImportRow {
  secret: string
}

export interface ImportResult {
  batchId: number
  importedCount: number
  validCount: number
  duplicateCount: number
  invalidCount: number
}

export async function importInventory(
  productId: number,
  items: ImportRow[],
  batchName: string,
  createdBy: number
): Promise<ImportResult> {
  const db = getDb()

  const duplicates = new Set<string>()
  const fingerprints = items.map(item => fingerprint(item.secret))
  for (const fp of fingerprints) {
    if (duplicates.has(fp)) continue
    // check DB for existing fingerprint for this product
    const existing = await db
      .select({ id: inventoryItems.id })
      .from(inventoryItems)
      .where(and(eq(inventoryItems.productId, productId), eq(inventoryItems.fingerprint, fp)))
      .limit(1)
    if (existing.length > 0) duplicates.add(fp)
    duplicates.add(fp)
  }

  let duplicateCount = 0
  const validRows: Array<typeof inventoryItems.$inferInsert> = []
  for (let i = 0; i < items.length; i++) {
    const fp = fingerprints[i]
    if (fp === undefined) continue
    const item = items[i]
    if (!item) continue
    if (duplicates.has(fp) && validRows.some(r => r.fingerprint === fp)) {
      duplicateCount++
      continue
    }
    const encrypted = encryptSecret(item.secret)
    validRows.push({
      productId,
      batchId: 0, // set after batch insert
      status: 'available',
      secretCiphertext: encrypted.ciphertext,
      secretNonce: encrypted.nonce,
      secretAuthTag: encrypted.authTag,
      fingerprint: fp
    })
  }

  const validCount = validRows.length
  const invalidCount = 0
  const importedCount = items.length

  const [batch] = await db.insert(inventoryBatches).values({
    productId,
    batchName,
    importedCount,
    validCount,
    duplicateCount,
    invalidCount,
    createdBy
  })
  if (!batch) throw new Error('batch insert failed')

  if (validRows.length > 0) {
    await db.insert(inventoryItems).values(
      validRows.map(r => ({ ...r, batchId: batch.insertId }))
    )
  }

  return { batchId: batch.insertId, importedCount, validCount, duplicateCount, invalidCount }
}

/** reserve N available items for an order (10-minute hold) */
export async function reserveInventory(
  productId: number,
  quantity: number,
  orderId: number
): Promise<number[]> {
  const db = getDb()
  const reservedUntil = new Date(Date.now() + 10 * 60_000)

  const available = await db
    .select({ id: inventoryItems.id })
    .from(inventoryItems)
    .where(and(
      eq(inventoryItems.productId, productId),
      eq(inventoryItems.status, 'available')
    ))
    .orderBy(asc(inventoryItems.id))
    .limit(quantity)

  if (available.length < quantity) {
    throw createError({ statusCode: 409, statusMessage: 'Insufficient stock' })
  }

  const reservedIds: number[] = []
  for (const item of available) {
    await db
      .update(inventoryItems)
      .set({ status: 'reserved', reservedUntil, orderId })
      .where(eq(inventoryItems.id, item.id))
    reservedIds.push(item.id)
  }
  return reservedIds
}

/** release reserved items back to available (on cancel/expire) */
export async function releaseReserved(orderId: number): Promise<number> {
  const result = await getDb()
    .update(inventoryItems)
    .set({ status: 'available', reservedUntil: null, orderId: null })
    .where(and(
      eq(inventoryItems.orderId, orderId),
      eq(inventoryItems.status, 'reserved')
    ))
  return result[0]?.affectedRows ?? 0
}

/** allocate + deliver reserved items for a paid order */
export async function deliverReserved(orderId: number): Promise<Array<{ id: number, secret: string }>> {
  const db = getDb()
  const items = await db
    .select()
    .from(inventoryItems)
    .where(and(
      eq(inventoryItems.orderId, orderId),
      eq(inventoryItems.status, 'reserved')
    ))

  const delivered: Array<{ id: number, secret: string }> = []
  for (const item of items) {
    const secret = decryptSecret({
      ciphertext: item.secretCiphertext,
      nonce: item.secretNonce,
      authTag: item.secretAuthTag
    })
    await db
      .update(inventoryItems)
      .set({ status: 'delivered', deliveredAt: new Date() })
      .where(eq(inventoryItems.id, item.id))
    delivered.push({ id: item.id, secret })
  }
  return delivered
}

/** release expired reservations (called from scheduler) */
export async function releaseExpiredReservations(): Promise<number> {
  const result = await getDb()
    .update(inventoryItems)
    .set({ status: 'available', reservedUntil: null, orderId: null })
    .where(and(
      eq(inventoryItems.status, 'reserved'),
      lt(inventoryItems.reservedUntil, new Date())
    ))
  return result[0]?.affectedRows ?? 0
}
