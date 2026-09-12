import { desc, eq, and, gte, lte, isNull, count, sql } from 'drizzle-orm'
import { getDb, isBlogDbReady } from '../../repositories/db.server'
import { exportJobs } from '../../repositories/schema/exports'
import { orders } from '../../repositories/schema/orders'
import { financialTransactions } from '../../repositories/schema/payments'
import { products, inventoryItems } from '../../repositories/schema/products'

/* Export service (commerce doc §11): CSV exports of orders, financial
   transactions and inventory summaries. Generated synchronously into
   nitro "exports" storage; job rows track state. CSV cells are guarded
   against spreadsheet formula injection (§12 hardening). */

export const EXPORT_TYPES = ['orders', 'transactions', 'inventory'] as const
export type ExportType = typeof EXPORT_TYPES[number]

export interface ExportJobRow {
  id: number
  type: string
  status: string
  dateFrom: string | null
  dateTo: string | null
  rowCount: number
  fileKey: string | null
  createdBy: number
  createdAt: Date
  completedAt: Date | null
  error: string | null
}

function toRow(r: typeof exportJobs.$inferSelect): ExportJobRow {
  return {
    id: r.id,
    type: r.type,
    status: r.status,
    dateFrom: r.dateFrom ? new Date(r.dateFrom).toISOString().slice(0, 10) : null,
    dateTo: r.dateTo ? new Date(r.dateTo).toISOString().slice(0, 10) : null,
    rowCount: r.rowCount,
    fileKey: r.fileKey,
    createdBy: r.createdBy,
    createdAt: r.createdAt,
    completedAt: r.completedAt,
    error: r.error
  }
}

/** guard against CSV formula injection: neutralize leading =+-@ */
function csvCell(value: unknown): string {
  const s = value === null || value === undefined ? '' : String(value)
  if (/^[=+\-@\t\r]/.test(s)) {
    return `'${s}`
  }
  return s
}

function toCsv(headers: string[], rows: Array<Array<unknown>>): string {
  const escape = (cell: string) =>
    /[",\n\r]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell
  const lines = [headers.map(csvCell).map(escape).join(',')]
  for (const row of rows) {
    lines.push(row.map(csvCell).map(escape).join(','))
  }
  return lines.join('\r\n') + '\r\n'
}

function dayStart(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`)
}
function dayEnd(date: string): Date {
  return new Date(`${date}T23:59:59.999Z`)
}

async function buildOrdersCsv(from: string | null, to: string | null): Promise<Array<Array<unknown>>> {
  const db = getDb()
  const conditions = []
  if (from) conditions.push(gte(orders.createdAt, dayStart(from)))
  if (to) conditions.push(lte(orders.createdAt, dayEnd(to)))
  const query = db.select({
    orderNumber: orders.orderNumber,
    email: orders.email,
    status: orders.status,
    paymentStatus: orders.paymentStatus,
    fulfillmentStatus: orders.fulfillmentStatus,
    currency: orders.currency,
    subtotalMinor: orders.subtotalMinor,
    totalMinor: orders.totalMinor,
    createdAt: orders.createdAt
  }).from(orders)
  const rows = conditions.length > 0
    ? await query.where(and(...conditions)).orderBy(desc(orders.createdAt))
    : await query.orderBy(desc(orders.createdAt))
  return rows.map(r => [
    r.orderNumber, r.email, r.status, r.paymentStatus, r.fulfillmentStatus,
    r.currency, r.subtotalMinor, r.totalMinor, r.createdAt?.toISOString() ?? ''
  ])
}

async function buildTransactionsCsv(from: string | null, to: string | null): Promise<Array<Array<unknown>>> {
  const db = getDb()
  const conditions = []
  if (from) conditions.push(gte(financialTransactions.occurredAt, dayStart(from)))
  if (to) conditions.push(lte(financialTransactions.occurredAt, dayEnd(to)))
  const query = db.select({
    transactionNumber: financialTransactions.transactionNumber,
    orderId: financialTransactions.orderId,
    type: financialTransactions.type,
    status: financialTransactions.status,
    gatewayKey: financialTransactions.gatewayKey,
    amountMinor: financialTransactions.amountMinor,
    currency: financialTransactions.currency,
    occurredAt: financialTransactions.occurredAt,
    description: financialTransactions.description
  }).from(financialTransactions)
  const rows = conditions.length > 0
    ? await query.where(and(...conditions)).orderBy(desc(financialTransactions.occurredAt))
    : await query.orderBy(desc(financialTransactions.occurredAt))
  return rows.map(r => [
    r.transactionNumber, r.orderId, r.type, r.status, r.gatewayKey,
    r.amountMinor, r.currency, r.occurredAt?.toISOString() ?? '', r.description
  ])
}

/** inventory SUMMARY per product — aggregates only, never secrets (§12.2) */
async function buildInventoryCsv(): Promise<Array<Array<unknown>>> {
  const db = getDb()
  const rows = await db
    .select({
      alias: products.alias,
      status: inventoryItems.status,
      total: count()
    })
    .from(inventoryItems)
    .innerJoin(products, eq(inventoryItems.productId, products.id))
    .where(isNull(products.deletedAt))
    .groupBy(products.alias, inventoryItems.status)
    .orderBy(sql`products.alias, ${inventoryItems.status}`)
  return rows.map(r => [r.alias, r.status, r.total])
}

const HEADERS: Record<ExportType, string[]> = {
  orders: ['order_number', 'email', 'status', 'payment_status', 'fulfillment_status', 'currency', 'subtotal_minor', 'total_minor', 'created_at'],
  transactions: ['transaction_number', 'order_id', 'type', 'status', 'gateway_key', 'amount_minor', 'currency', 'occurred_at', 'description'],
  inventory: ['product_alias', 'item_status', 'count']
}

async function buildRows(type: ExportType, from: string | null, to: string | null): Promise<Array<Array<unknown>>> {
  if (!isBlogDbReady()) {
    throw new Error('Database unavailable')
  }
  if (type === 'orders') return buildOrdersCsv(from, to)
  if (type === 'transactions') return buildTransactionsCsv(from, to)
  return buildInventoryCsv()
}

/** create a job and generate its CSV synchronously (v1 scale) */
export async function createExportJob(type: ExportType, dateFrom: string | null, dateTo: string | null, userId: number): Promise<ExportJobRow> {
  const db = getDb()
  const [row] = await db.insert(exportJobs).values({
    type,
    status: 'pending',
    dateFrom,
    dateTo,
    createdBy: userId
  })
  const jobId = row!.insertId
  try {
    const rows = await buildRows(type, dateFrom, dateTo)
    const csv = toCsv(HEADERS[type], rows)
    const fileKey = `export-${jobId}.csv`
    await useStorage('exports').setItemRaw(fileKey, Buffer.from(csv, 'utf8'))
    await db.update(exportJobs).set({
      status: 'completed',
      rowCount: rows.length,
      fileKey,
      completedAt: new Date()
    }).where(eq(exportJobs.id, jobId))
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await db.update(exportJobs).set({
      status: 'failed',
      error: message.slice(0, 500),
      completedAt: new Date()
    }).where(eq(exportJobs.id, jobId))
  }
  const [job] = await db.select().from(exportJobs).where(eq(exportJobs.id, jobId)).limit(1)
  return toRow(job!)
}

export async function listExportJobs(limit = 50): Promise<ExportJobRow[]> {
  if (!isBlogDbReady()) return []
  const rows = await getDb().select().from(exportJobs).orderBy(desc(exportJobs.createdAt)).limit(limit)
  return rows.map(toRow)
}

export async function getExportJob(id: number): Promise<ExportJobRow | undefined> {
  const rows = await getDb().select().from(exportJobs).where(eq(exportJobs.id, id)).limit(1)
  return rows[0] ? toRow(rows[0]) : undefined
}

export async function readExportFile(fileKey: string): Promise<Buffer | null> {
  return (await useStorage('exports').getItemRaw(fileKey)) ?? null
}
