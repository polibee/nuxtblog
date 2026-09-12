import { eq, desc, and } from 'drizzle-orm'
import { getDb } from './db.server'
import { paymentAttempts, financialTransactions, paymentWebhookEvents } from './schema/payments'

/* Payment Attempt + Financial Transaction management (commerce doc §8.4, §10).
   All operations are idempotent — repeated calls return the original result. */

export interface PaymentAttemptRow {
  id: number
  orderId: number
  gatewayKey: string
  idempotencyKey: string
  providerOrderId: string | null
  providerPaymentId: string | null
  providerCaptureId: string | null
  status: string
  amountMinor: number
  currency: string
  approvalUrl: string | null
}

export async function createPaymentAttempt(input: {
  orderId: number
  gatewayKey: string
  idempotencyKey: string
  amountMinor: number
  currency: string
}): Promise<PaymentAttemptRow> {
  const db = getDb()
  const [row] = await db.insert(paymentAttempts).values(input)
  if (!row) throw new Error('payment attempt insert returned no id')
  return {
    id: row.insertId,
    orderId: input.orderId,
    gatewayKey: input.gatewayKey,
    idempotencyKey: input.idempotencyKey,
    providerOrderId: null,
    providerPaymentId: null,
    providerCaptureId: null,
    status: 'created',
    amountMinor: input.amountMinor,
    currency: input.currency,
    approvalUrl: null
  }
}

export async function updatePaymentAttemptStatus(id: number, patch: {
  status?: string
  providerOrderId?: string
  providerPaymentId?: string
  providerCaptureId?: string
  approvalUrl?: string
  failureCode?: string | null
  failureMessage?: string | null
}): Promise<void> {
  await getDb().update(paymentAttempts).set(patch).where(eq(paymentAttempts.id, id))
}

export async function findPaymentAttemptByIdempotencyKey(key: string): Promise<PaymentAttemptRow | undefined> {
  const rows = await getDb().select().from(paymentAttempts).where(eq(paymentAttempts.idempotencyKey, key)).limit(1)
  return rows[0]
}

export async function listPaymentAttemptsForOrder(orderId: number): Promise<PaymentAttemptRow[]> {
  return getDb().select().from(paymentAttempts).where(eq(paymentAttempts.orderId, orderId)).orderBy(desc(paymentAttempts.createdAt))
}

export async function insertFinancialTransaction(input: {
  transactionNumber: string
  orderId: number | null
  paymentAttemptId: number | null
  gatewayKey: string | null
  type: string
  status: string
  amountMinor: number
  currency: string
  providerTransactionId: string | null
  description: string | null
}): Promise<number> {
  const [row] = await getDb().insert(financialTransactions).values({
    ...input,
    occurredAt: new Date()
  })
  if (!row) throw new Error('financial transaction insert returned no id')
  return row.insertId
}

export function generateTransactionNumber(): string {
  const ts = Date.now().toString(36).toUpperCase()
  const rand = Math.random().toString(36).toUpperCase().slice(2, 6)
  return `TXN-${ts}${rand}`
}

/** record a charge transaction for a captured payment */
export async function recordCharge(orderId: number, attemptId: number, gatewayKey: string, amountMinor: number, currency: string): Promise<number> {
  return insertFinancialTransaction({
    transactionNumber: generateTransactionNumber(),
    orderId,
    paymentAttemptId: attemptId,
    gatewayKey,
    type: 'charge',
    status: 'completed',
    amountMinor,
    currency,
    providerTransactionId: null,
    description: `Charge for order #${orderId}`
  })
}

/** record a refund transaction linked to the original charge */
export async function recordRefund(orderId: number, amountMinor: number, currency: string, description: string): Promise<number> {
  return insertFinancialTransaction({
    transactionNumber: generateTransactionNumber(),
    orderId,
    paymentAttemptId: null,
    gatewayKey: null,
    type: 'refund',
    status: 'completed',
    amountMinor,
    currency,
    providerTransactionId: null,
    description
  })
}

/* --- Webhook events (commerce doc §8.5) --- */

export interface WebhookEventRow {
  id: number
  gatewayKey: string
  providerEventId: string
  eventType: string
  signatureVerified: boolean
  processingStatus: string
}

/** idempotent insert: duplicate (gateway, provider_event_id) already fully
    processed → duplicated=true (skip); received/failed rows can be retried. */
export async function recordWebhookEvent(input: {
  gatewayKey: string
  providerEventId: string
  eventType: string
  signatureVerified: boolean
  payloadCiphertext: string | null
}): Promise<{ row: WebhookEventRow, duplicated: boolean }> {
  const db = getDb()
  await db.insert(paymentWebhookEvents).values({
    gatewayKey: input.gatewayKey,
    providerEventId: input.providerEventId,
    eventType: input.eventType,
    signatureVerified: input.signatureVerified,
    payloadCiphertext: input.payloadCiphertext,
    receivedAt: new Date()
  }).onDuplicateKeyUpdate({
    set: { signatureVerified: input.signatureVerified }
  })
  const rows = await db.select().from(paymentWebhookEvents).where(and(
    eq(paymentWebhookEvents.gatewayKey, input.gatewayKey),
    eq(paymentWebhookEvents.providerEventId, input.providerEventId)
  )).limit(1)
  const row = rows[0]
  if (!row) throw new Error('webhook event insert returned no row')
  return {
    row: {
      id: row.id,
      gatewayKey: row.gatewayKey,
      providerEventId: row.providerEventId,
      eventType: row.eventType,
      signatureVerified: row.signatureVerified,
      processingStatus: row.processingStatus
    },
    duplicated: row.processingStatus === 'processed' || row.processingStatus === 'skipped'
  }
}

export async function updateWebhookEventProcessing(id: number, patch: {
  processingStatus?: string
  errorMessage?: string | null
}): Promise<void> {
  await getDb().update(paymentWebhookEvents).set({
    ...patch,
    processedAt: new Date()
  }).where(eq(paymentWebhookEvents.id, id))
}
