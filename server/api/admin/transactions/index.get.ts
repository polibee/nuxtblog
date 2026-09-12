import { and, desc, eq, gte, lte, sql } from 'drizzle-orm'
import { requirePermission } from '../../../utils/auth'
import { getDb, isBlogDbReady } from '../../../repositories/db.server'
import { financialTransactions } from '../../../repositories/schema/payments'
import { orders } from '../../../repositories/schema/orders'
import type { Paginated } from '#shared/types/api'

/** GET /api/admin/transactions — financial transactions ledger
    (charges/refunds for both product and membership orders). Supports
    type filter and date range; joined with orders for order numbers. */
export default defineEventHandler(async (event) => {
  await requirePermission(event, 'store.orders.view')
  if (!isBlogDbReady()) {
    const empty: Paginated<Record<string, unknown>> = { items: [], total: 0, page: 1, perPage: 20, totalPages: 1 }
    return empty
  }
  const query = getQuery(event) as {
    page?: number
    perPage?: number
    type?: string
    dateFrom?: string
    dateTo?: string
  }
  const page = Math.max(Number(query.page) || 1, 1)
  const perPage = Math.min(Math.max(Number(query.perPage) || 20, 1), 100)

  const conditions = []
  if (query.type && ['charge', 'refund', 'fee', 'adjustment', 'chargeback'].includes(query.type)) {
    conditions.push(eq(financialTransactions.type, query.type))
  }
  if (query.dateFrom && /^\d{4}-\d{2}-\d{2}$/.test(query.dateFrom)) {
    conditions.push(gte(financialTransactions.occurredAt, new Date(`${query.dateFrom}T00:00:00.000Z`)))
  }
  if (query.dateTo && /^\d{4}-\d{2}-\d{2}$/.test(query.dateTo)) {
    conditions.push(lte(financialTransactions.occurredAt, new Date(`${query.dateTo}T23:59:59.999Z`)))
  }
  const where = conditions.length > 0 ? and(...conditions) : undefined

  const rows = await getDb()
    .select({
      id: financialTransactions.id,
      transactionNumber: financialTransactions.transactionNumber,
      type: financialTransactions.type,
      status: financialTransactions.status,
      amountMinor: financialTransactions.amountMinor,
      currency: financialTransactions.currency,
      gatewayKey: financialTransactions.gatewayKey,
      orderId: financialTransactions.orderId,
      orderNumber: orders.orderNumber,
      orderStatus: orders.status,
      occurredAt: financialTransactions.occurredAt,
      description: financialTransactions.description
    })
    .from(financialTransactions)
    .leftJoin(orders, eq(financialTransactions.orderId, orders.id))
    .where(where)
    .orderBy(desc(financialTransactions.occurredAt))
    .limit(perPage)
    .offset((page - 1) * perPage)

  const [totals] = await getDb()
    .select({ total: sql<number>`count(*)` })
    .from(financialTransactions)
    .where(where)
  const total = Number(totals?.total ?? 0)

  const result: Paginated<(typeof rows)[number]> = {
    items: rows,
    total,
    page,
    perPage,
    totalPages: Math.max(Math.ceil(total / perPage), 1)
  }
  return result
})
