import { createError } from 'h3'
import { eq } from 'drizzle-orm'
import { getDb } from '../../repositories/db.server'
import { findOrderByNumber, findOrderRow, type OrderRow } from '../../repositories/order.repository'
import { paymentAttempts } from '../../repositories/schema/payments'
import {
  createPaymentAttempt,
  listPaymentAttemptsForOrder,
  recordWebhookEvent,
  updatePaymentAttemptStatus,
  updateWebhookEventProcessing,
  type PaymentAttemptRow
} from '../../repositories/payment.repository'
import { findGatewayByKey, insertGateway, listGateways, type GatewayRow } from '../../repositories/gateway.repository'
import { encryptSecret } from '../../utils/encryption'
import { processPaidOrder, refundOrder } from '../store/order-lifecycle.service'
import type {
  PaymentGatewayDriver,
  WebhookVerificationResult
} from './gateway-driver'
import { MockDriver } from './drivers/mock.driver'
import { PayPalDriver } from './drivers/paypal.driver'
import { CreemDriver } from './drivers/creem.driver'
import { LemonSqueezyDriver } from './drivers/lemonsqueezy.driver'
import { NowPaymentsDriver } from './drivers/nowpayments.driver'
import { XcashDriver } from './drivers/xcash.driver'
import { WaffoDriver } from './drivers/waffo.driver'

/* Gateway Manager (commerce doc §8.1): the only entry point business
   code uses to talk to payment providers. Persists every state change
   on payment_attempts and stays idempotent. */

const driverRegistry: Record<string, () => PaymentGatewayDriver> = {
  mock: () => new MockDriver(),
  paypal: () => new PayPalDriver(),
  creem: () => new CreemDriver(),
  lemonsqueezy: () => new LemonSqueezyDriver(),
  nowpayments: () => new NowPaymentsDriver(),
  xcash: () => new XcashDriver(),
  waffo: () => new WaffoDriver()
}

export function knownProviders(): string[] {
  return Object.keys(driverRegistry)
}

export function getDriver(providerKey: string): PaymentGatewayDriver {
  const factory = driverRegistry[providerKey]
  if (!factory) {
    throw createError({ statusCode: 422, statusMessage: `Unknown gateway provider: ${providerKey}` })
  }
  return factory()
}

export function gatewaySupportsCurrency(gateway: GatewayRow, currency: string): boolean {
  if (!gateway.enabledCurrencies) return true
  const list = gateway.enabledCurrencies.split(',').map(c => c.trim().toUpperCase()).filter(Boolean)
  return list.length === 0 || list.includes(currency.toUpperCase())
}

/** checkout methods: enabled gateways, optionally filtered by currency */
export async function listCheckoutMethods(currency?: string): Promise<Array<{ key: string, displayName: string, providerKey: string }>> {
  const gateways = await listGateways(true)
  return gateways
    .filter(g => !currency || gatewaySupportsCurrency(g, currency))
    .map(g => ({ key: g.key, displayName: g.displayName, providerKey: g.providerKey }))
}

async function requireOrder(orderNumber: string): Promise<OrderRow> {
  const order = await findOrderByNumber(orderNumber)
  if (!order) {
    throw createError({ statusCode: 404, statusMessage: 'Order not found' })
  }
  return order
}

async function requireGateway(gatewayKey: string): Promise<GatewayRow> {
  const gateway = await findGatewayByKey(gatewayKey)
  if (!gateway) {
    throw createError({ statusCode: 404, statusMessage: 'Gateway not found' })
  }
  return gateway
}

function assertPayable(order: OrderRow, gateway: GatewayRow): void {
  if (order.status !== 'pending_payment') {
    throw createError({ statusCode: 409, statusMessage: `Order ${order.orderNumber} is not payable (status: ${order.status})` })
  }
  if (!gateway.enabled) {
    throw createError({ statusCode: 422, statusMessage: 'Gateway is not enabled' })
  }
  if (!gatewaySupportsCurrency(gateway, order.currency)) {
    throw createError({ statusCode: 422, statusMessage: `Gateway ${gateway.key} does not support ${order.currency}` })
  }
}

function attemptRow(r: typeof paymentAttempts.$inferSelect): PaymentAttemptRow {
  return {
    id: r.id,
    orderId: r.orderId,
    gatewayKey: r.gatewayKey,
    idempotencyKey: r.idempotencyKey,
    providerOrderId: r.providerOrderId,
    providerPaymentId: r.providerPaymentId,
    providerCaptureId: r.providerCaptureId,
    status: r.status,
    amountMinor: r.amountMinor,
    currency: r.currency,
    approvalUrl: r.approvalUrl
  }
}

async function findAttemptByProviderOrderId(providerOrderId: string): Promise<PaymentAttemptRow | undefined> {
  const rows = await getDb().select().from(paymentAttempts).where(eq(paymentAttempts.providerOrderId, providerOrderId)).limit(1)
  return rows[0] ? attemptRow(rows[0]) : undefined
}

async function findAttemptsByProviderCaptureId(captureId: string): Promise<PaymentAttemptRow[]> {
  const rows = await getDb().select().from(paymentAttempts).where(eq(paymentAttempts.providerCaptureId, captureId))
  return rows.map(attemptRow)
}

function toPublicAttempt(attempt: PaymentAttemptRow) {
  return {
    gatewayKey: attempt.gatewayKey,
    status: attempt.status,
    approvalUrl: attempt.approvalUrl,
    amountMinor: attempt.amountMinor,
    currency: attempt.currency
  }
}

export interface StartPaymentResult {
  orderNumber: string
  gatewayKey: string
  status: string
  approvalUrl: string
  amountMinor: number
  currency: string
}

/** POST payment: create provider order + local attempt (idempotent). */
export async function startPayment(orderNumber: string, gatewayKey: string, origin: string): Promise<StartPaymentResult> {
  const order = await requireOrder(orderNumber)
  const gateway = await requireGateway(gatewayKey)
  assertPayable(order, gateway)
  const driver = getDriver(gateway.providerKey)

  const existing = (await listPaymentAttemptsForOrder(order.id)).filter(a => a.gatewayKey === gatewayKey)
  const lastActive = existing.find(a => a.status === 'created' || a.status === 'approved')
  if (lastActive && lastActive.approvalUrl) {
    return { orderNumber, gatewayKey, status: lastActive.status, approvalUrl: lastActive.approvalUrl, amountMinor: order.totalMinor, currency: order.currency }
  }

  // retries after a failed attempt need a fresh idempotency key
  const idempotencyKey = existing.length === 0
    ? `${orderNumber}:${gatewayKey}`
    : `${orderNumber}:${gatewayKey}:${existing.length + 1}`
  const attempt = await createPaymentAttempt({
    orderId: order.id,
    gatewayKey,
    idempotencyKey,
    amountMinor: order.totalMinor,
    currency: order.currency
  })

  try {
    const result = await driver.createPayment({
      orderNumber,
      amountMinor: order.totalMinor,
      currency: order.currency,
      customerEmail: order.email || null,
      returnUrl: `${origin}/api/public/payments/${gatewayKey}/return?order=${encodeURIComponent(orderNumber)}`,
      cancelUrl: `${origin}/checkout/${encodeURIComponent(orderNumber)}?canceled=1`,
      webhookUrl: `${origin}/api/public/payments/${gatewayKey}/webhook`,
      idempotencyKey,
      config: gateway.config ?? {},
      mode: gateway.mode === 'live' ? 'live' : 'sandbox'
    })
    await updatePaymentAttemptStatus(attempt.id, {
      status: 'created',
      providerOrderId: result.providerOrderId,
      approvalUrl: result.approvalUrl
    })
    return { orderNumber, gatewayKey, status: 'created', approvalUrl: result.approvalUrl, amountMinor: order.totalMinor, currency: order.currency }
  } catch (error) {
    const normalized = driver.normalizeError(error)
    await updatePaymentAttemptStatus(attempt.id, {
      status: 'failed',
      failureCode: normalized.code,
      failureMessage: normalized.message.slice(0, 500)
    })
    throw createError({ statusCode: 502, statusMessage: `Payment gateway error: ${normalized.message}` })
  }
}

/** verify provider capture result against the order snapshot (§9.1 #9) */
function assertCaptureMatchesOrder(order: OrderRow, amountMinor: number | null, currency: string | null): void {
  if (amountMinor !== null && amountMinor !== order.totalMinor) {
    throw createError({ statusCode: 409, statusMessage: `Capture amount ${amountMinor} does not match order total ${order.totalMinor}` })
  }
  if (currency !== null && currency.toUpperCase() !== order.currency.toUpperCase()) {
    throw createError({ statusCode: 409, statusMessage: `Capture currency ${currency} does not match order currency ${order.currency}` })
  }
}

/** server-side capture of an approved payment; idempotent. */
export async function captureAttempt(attempt: PaymentAttemptRow, order: OrderRow): Promise<void> {
  if (attempt.status === 'captured') return
  if (order.status !== 'pending_payment') return
  const gateway = await requireGateway(attempt.gatewayKey)
  const driver = getDriver(gateway.providerKey)
  const capture = await driver.capturePayment({
    providerOrderId: attempt.providerOrderId ?? '',
    idempotencyKey: `${attempt.idempotencyKey}:capture`,
    config: gateway.config ?? {},
    mode: gateway.mode === 'live' ? 'live' : 'sandbox'
  }).catch(async (error) => {
    const normalized = driver.normalizeError(error)
    await updatePaymentAttemptStatus(attempt.id, {
      status: 'failed',
      failureCode: normalized.code,
      failureMessage: normalized.message.slice(0, 500)
    })
    throw createError({ statusCode: 502, statusMessage: `Capture failed: ${normalized.message}` })
  })

  assertCaptureMatchesOrder(order, capture.amountMinor, capture.currency)
  if (capture.status === 'completed' && capture.providerCaptureId) {
    await updatePaymentAttemptStatus(attempt.id, {
      status: 'captured',
      providerCaptureId: capture.providerCaptureId
    })
    await processPaidOrder(order.id, attempt.gatewayKey, attempt.id, attempt.amountMinor, attempt.currency)
    return
  }
  if (capture.status === 'pending') {
    await updatePaymentAttemptStatus(attempt.id, { status: 'pending' })
    return
  }
  await updatePaymentAttemptStatus(attempt.id, {
    status: 'failed',
    failureCode: 'capture_incomplete',
    failureMessage: 'Provider capture did not complete'
  })
  throw createError({ statusCode: 502, statusMessage: 'Capture did not complete at the gateway' })
}

/** provider status sync + opportunistic capture (return page / polling, §9.5) */
export async function syncPaymentStatus(orderNumber: string): Promise<{
  orderStatus: string
  paymentStatus: string
  attempt: ReturnType<typeof toPublicAttempt> | null
}> {
  const order = await requireOrder(orderNumber)
  const attempts = await listPaymentAttemptsForOrder(order.id)
  const latest = attempts[0]
  if (!latest) {
    return { orderStatus: order.status, paymentStatus: order.paymentStatus, attempt: null }
  }
  if (order.status === 'pending_payment' && (latest.status === 'created' || latest.status === 'approved')) {
    const gateway = await requireGateway(latest.gatewayKey)
    const driver = getDriver(gateway.providerKey)
    try {
      const status = await driver.getPaymentStatus({
        providerOrderId: latest.providerOrderId ?? '',
        config: gateway.config ?? {},
        mode: gateway.mode === 'live' ? 'live' : 'sandbox'
      })
      if (status.status === 'approved' && latest.status !== 'approved') {
        await updatePaymentAttemptStatus(latest.id, { status: 'approved' })
        latest.status = 'approved'
      }
      if (status.status === 'captured' && status.providerCaptureId) {
        assertCaptureMatchesOrder(order, status.amountMinor, status.currency)
        await updatePaymentAttemptStatus(latest.id, {
          status: 'captured',
          providerCaptureId: status.providerCaptureId
        })
        latest.status = 'captured'
        await processPaidOrder(order.id, latest.gatewayKey, latest.id, latest.amountMinor, latest.currency)
      }
    } catch {
      // provider unreachable: report local state, next poll retries
    }
  }
  // re-read: the capture above may have transitioned the order within this request
  const finalOrder = await findOrderRow(order.id)
  return {
    orderStatus: finalOrder?.status ?? order.status,
    paymentStatus: finalOrder?.paymentStatus ?? order.paymentStatus,
    attempt: toPublicAttempt(latest)
  }
}

/** dispatch a verified webhook event to order/attempt state (§8.5, §9.2) */
export async function handleWebhook(gatewayKey: string, headers: Record<string, string>, rawBody: string): Promise<{ processed: boolean, duplicate?: boolean, eventType?: string }> {
  const gateway = await requireGateway(gatewayKey)
  const driver = getDriver(gateway.providerKey)
  const config = { ...(gateway.config ?? {}), mode: gateway.mode }

  let verification: WebhookVerificationResult
  try {
    verification = await driver.verifyWebhook(headers, rawBody, config)
  } catch (error) {
    const normalized = driver.normalizeError(error)
    throw createError({ statusCode: 502, statusMessage: `Webhook verification failed: ${normalized.message}` })
  }

  let payloadCiphertext: string | null = null
  try {
    payloadCiphertext = encryptSecret(rawBody.slice(0, 8000)).ciphertext
  } catch {
    // encryption key not configured: skip encrypted audit copy
  }

  const event = await recordWebhookEvent({
    gatewayKey,
    providerEventId: verification.providerEventId,
    eventType: verification.eventType,
    signatureVerified: verification.verified,
    payloadCiphertext
  })
  if (event.duplicated) {
    return { processed: true, duplicate: true, eventType: verification.eventType }
  }
  if (!verification.verified) {
    await updateWebhookEventProcessing(event.row.id, { processingStatus: 'skipped', errorMessage: 'Signature verification failed' })
    throw createError({ statusCode: 400, statusMessage: 'Webhook signature verification failed' })
  }

  try {
    await dispatchWebhookEvent(verification)
    await updateWebhookEventProcessing(event.row.id, { processingStatus: 'processed', errorMessage: null })
    return { processed: true, eventType: verification.eventType }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await updateWebhookEventProcessing(event.row.id, { processingStatus: 'failed', errorMessage: message.slice(0, 500) })
    throw error
  }
}

/** locate the attempt for a webhook event: by provider order id first,
    then by the merchant order number the provider echoed back */
async function resolveAttemptForWebhook(verification: WebhookVerificationResult): Promise<PaymentAttemptRow | undefined> {
  if (verification.providerOrderId) {
    const byProvider = await findAttemptByProviderOrderId(verification.providerOrderId)
    if (byProvider) return byProvider
  }
  if (verification.merchantOrderNumber) {
    const order = await findOrderByNumber(verification.merchantOrderNumber)
    if (order) {
      const attempts = await listPaymentAttemptsForOrder(order.id)
      return attempts[0]
    }
  }
  return undefined
}

/** webhook-authoritative providers confirm via the verified event; others
    require an extra server-side capture/status API call */
async function driverSupportsCaptureApi(gatewayKey: string): Promise<boolean> {
  try {
    const gateway = await requireGateway(gatewayKey)
    return getDriver(gateway.providerKey).supports('capture_api')
  } catch {
    return false
  }
}

async function dispatchWebhookEvent(verification: WebhookVerificationResult): Promise<void> {
  const { eventType, providerOrderId, providerCaptureId } = verification
  if (eventType === 'CHECKOUT.ORDER.APPROVED' && providerOrderId) {
    const attempt = await findAttemptByProviderOrderId(providerOrderId)
    if (attempt && attempt.status === 'created') {
      await updatePaymentAttemptStatus(attempt.id, { status: 'approved' })
    }
    return
  }
  if (eventType === 'CHECKOUT.PAYMENT-APPROVAL.REVERSED' && providerOrderId) {
    const attempt = await findAttemptByProviderOrderId(providerOrderId)
    if (attempt && attempt.status !== 'captured') {
      await updatePaymentAttemptStatus(attempt.id, { status: 'canceled' })
    }
    return
  }
  if (eventType === 'PAYMENT.CAPTURE.COMPLETED') {
    const attempt = await resolveAttemptForWebhook(verification)
    if (!attempt) {
      throw new Error(`No payment attempt for provider order ${providerOrderId ?? 'unknown'}`)
    }
    const order = await findOrderRow(attempt.orderId)
    if (!order) throw new Error(`Order #${attempt.orderId} not found`)
    if (order.status !== 'pending_payment') return
    if (await driverSupportsCaptureApi(attempt.gatewayKey)) {
      // authoritative capture via API (§3.2): the webhook alone does not confirm
      await captureAttempt(attempt, order)
      return
    }
    // webhook-authoritative providers: the verified event IS the confirmation
    assertCaptureMatchesOrder(order, verification.amountMinor, verification.currency)
    await updatePaymentAttemptStatus(attempt.id, {
      status: 'captured',
      providerCaptureId: verification.providerCaptureId ?? undefined
    })
    await processPaidOrder(order.id, attempt.gatewayKey, attempt.id, attempt.amountMinor, attempt.currency)
    return
  }
  if ((eventType === 'PAYMENT.CAPTURE.DENIED' || eventType === 'PAYMENT.CAPTURE.REVERSED')) {
    const attempt = await resolveAttemptForWebhook(verification)
    if (attempt && attempt.status !== 'captured') {
      await updatePaymentAttemptStatus(attempt.id, {
        status: 'failed',
        failureCode: eventType.toLowerCase(),
        failureMessage: `Provider reported ${eventType}`
      })
    }
    return
  }
  if (eventType === 'PAYMENT.CAPTURE.REFUNDED') {
    let attempts: PaymentAttemptRow[] = []
    if (providerCaptureId) {
      attempts = await findAttemptsByProviderCaptureId(providerCaptureId)
    }
    if (attempts.length === 0 && verification.merchantOrderNumber) {
      const order = await findOrderByNumber(verification.merchantOrderNumber)
      if (order) {
        attempts = (await listPaymentAttemptsForOrder(order.id)).filter(a => a.status === 'captured')
      }
    }
    for (const attempt of attempts) {
      const order = await findOrderRow(attempt.orderId)
      if (order && order.paymentStatus === 'captured') {
        await refundOrder(order.id, order.totalMinor, order.currency)
      }
    }
  }
  // unknown event types: recorded as processed without state change
}

/** gateway refund for an order (admin); falls back to a local refund record
    when no captured attempt exists or the provider cannot refund via API. */
export async function refundOrderViaGateway(order: OrderRow, amountMinor: number | null = null): Promise<{ viaGateway: boolean }> {
  const attempts = await listPaymentAttemptsForOrder(order.id)
  const captured = attempts.find(a => a.status === 'captured' && a.providerCaptureId)
  if (!captured) {
    await refundOrder(order.id, amountMinor ?? order.totalMinor, order.currency)
    return { viaGateway: false }
  }
  const gateway = await requireGateway(captured.gatewayKey)
  const driver = getDriver(gateway.providerKey)
  if (!driver.supports('refund')) {
    // refund handled in the provider dashboard; record locally
    await refundOrder(order.id, amountMinor ?? order.totalMinor, order.currency)
    return { viaGateway: false }
  }
  const refund = await driver.refundPayment({
    providerCaptureId: captured.providerCaptureId!,
    amountMinor: amountMinor ?? order.totalMinor,
    currency: order.currency,
    idempotencyKey: `${captured.idempotencyKey}:refund`,
    config: gateway.config ?? {},
    mode: gateway.mode === 'live' ? 'live' : 'sandbox'
  })
  if (refund.status === 'failed') {
    throw createError({ statusCode: 502, statusMessage: 'Provider refund failed' })
  }
  await refundOrder(order.id, amountMinor ?? order.totalMinor, order.currency)
  return { viaGateway: true }
}

/** seed the dev mock gateway (enabled, sandbox) once. */
export async function seedDefaultGateways(): Promise<void> {
  const existing = await findGatewayByKey('mock')
  if (existing) return
  await insertGateway({
    key: 'mock',
    providerKey: 'mock',
    displayName: 'Mock (dev)',
    enabled: true,
    mode: 'sandbox',
    sortOrder: 0,
    enabledCurrencies: null,
    config: null
  })
}
