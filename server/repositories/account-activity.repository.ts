import { desc, eq } from 'drizzle-orm'
import { getDb, isBlogDbReady } from './db.server'
import { adCampaigns } from './schema/advertising'
import { comments } from './schema/comments'
import { exportJobs } from './schema/exports'
import { paymentAttempts } from './schema/payments'
import { orders } from './schema/orders'

export interface AccountActivity {
  orders: Array<{
    id: number
    orderNumber: string
    status: string
    paymentStatus: string
    totalMinor: number
    currency: string
    createdAt: Date
  }>
  payments: Array<{
    id: number
    orderNumber: string
    gatewayKey: string
    status: string
    amountMinor: number
    currency: string
    createdAt: Date
  }>
  comments: Array<{
    id: number
    postId: number
    content: string
    status: string
    createdAt: Date
  }>
  advertising: Array<{
    id: number
    name: string
    status: string
    budgetMinor: number
    currency: string
    orderNumber: string | null
    createdAt: Date
  }>
  exports: Array<{
    id: number
    type: string
    status: string
    rowCount: number
    createdAt: Date
    completedAt: Date | null
  }>
}

export async function findAccountActivity(userId: number): Promise<AccountActivity> {
  if (!isBlogDbReady()) {
    return { orders: [], payments: [], comments: [], advertising: [], exports: [] }
  }

  const db = getDb()
  const [orderRows, paymentRows, commentRows, advertisingRows, exportRows] = await Promise.all([
    db.select({
      id: orders.id,
      orderNumber: orders.orderNumber,
      status: orders.status,
      paymentStatus: orders.paymentStatus,
      totalMinor: orders.totalMinor,
      currency: orders.currency,
      createdAt: orders.createdAt
    }).from(orders).where(eq(orders.userId, userId)).orderBy(desc(orders.createdAt)).limit(100),
    db.select({
      id: paymentAttempts.id,
      orderNumber: orders.orderNumber,
      gatewayKey: paymentAttempts.gatewayKey,
      status: paymentAttempts.status,
      amountMinor: paymentAttempts.amountMinor,
      currency: paymentAttempts.currency,
      createdAt: paymentAttempts.createdAt
    }).from(paymentAttempts)
      .innerJoin(orders, eq(paymentAttempts.orderId, orders.id))
      .where(eq(orders.userId, userId))
      .orderBy(desc(paymentAttempts.createdAt)).limit(100),
    db.select({
      id: comments.id,
      postId: comments.postId,
      content: comments.content,
      status: comments.status,
      createdAt: comments.createdAt
    }).from(comments).where(eq(comments.userId, userId)).orderBy(desc(comments.createdAt)).limit(100),
    db.select({
      id: adCampaigns.id,
      name: adCampaigns.name,
      status: adCampaigns.status,
      budgetMinor: adCampaigns.budgetMinor,
      currency: adCampaigns.currency,
      orderNumber: orders.orderNumber,
      createdAt: adCampaigns.createdAt
    }).from(adCampaigns)
      .innerJoin(orders, eq(adCampaigns.orderId, orders.id))
      .where(eq(orders.userId, userId))
      .orderBy(desc(adCampaigns.createdAt)).limit(100),
    db.select({
      id: exportJobs.id,
      type: exportJobs.type,
      status: exportJobs.status,
      rowCount: exportJobs.rowCount,
      createdAt: exportJobs.createdAt,
      completedAt: exportJobs.completedAt
    }).from(exportJobs).where(eq(exportJobs.createdBy, userId)).orderBy(desc(exportJobs.createdAt)).limit(50)
  ])

  return {
    orders: orderRows,
    payments: paymentRows,
    comments: commentRows,
    advertising: advertisingRows,
    exports: exportRows
  }
}
