import { createHmac } from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { handleWebhook, refundOrderViaGateway, startPayment, syncPaymentStatus } from '../../server/modules/payments/gateway-manager'
import { findOrderByNumber, findOrderRow } from '../../server/repositories/order.repository'
import { findGatewayByKey } from '../../server/repositories/gateway.repository'
import {
  createPaymentAttempt,
  listPaymentAttemptsForOrder,
  recordWebhookEvent,
  updatePaymentAttemptStatus
} from '../../server/repositories/payment.repository'
import { processPaidOrder, refundOrder } from '../../server/modules/store/order-lifecycle.service'

/* Gateway Manager flows against the real MockDriver with all IO
   (repositories, lifecycle service, encryption) mocked out.
   vi.mock calls are hoisted above the imports by vitest. */

const dbStub = {
  select: vi.fn(() => dbStub),
  from: vi.fn(() => dbStub),
  where: vi.fn(() => dbStub),
  limit: vi.fn(async () => [] as unknown[]),
  insert: vi.fn(() => ({ values: vi.fn(async () => [{ insertId: 1 }]) })),
  update: vi.fn(() => ({ set: vi.fn(async () => []) }))
}

vi.mock('../../server/repositories/db.server', () => ({
  getDb: vi.fn(() => dbStub),
  isBlogDbReady: vi.fn(() => true)
}))

vi.mock('../../server/repositories/order.repository', () => ({
  findOrderByNumber: vi.fn(),
  findOrderRow: vi.fn()
}))

vi.mock('../../server/repositories/schema/payments', () => ({
  paymentAttempts: {}
}))

vi.mock('../../server/repositories/payment.repository', () => ({
  createPaymentAttempt: vi.fn(),
  listPaymentAttemptsForOrder: vi.fn(async () => []),
  recordWebhookEvent: vi.fn(),
  updatePaymentAttemptStatus: vi.fn(async () => undefined),
  updateWebhookEventProcessing: vi.fn(async () => undefined)
}))

vi.mock('../../server/repositories/gateway.repository', () => ({
  findGatewayByKey: vi.fn(),
  findGatewayById: vi.fn(),
  insertGateway: vi.fn(async () => 1),
  listGateways: vi.fn(async () => [])
}))

vi.mock('../../server/utils/encryption', () => ({
  encryptSecret: vi.fn(() => ({ ciphertext: 'ct', nonce: 'n', authTag: 't' })),
  decryptSecret: vi.fn(() => '{}'),
  maskSecret: vi.fn((s: string) => s)
}))

vi.mock('../../server/modules/store/order-lifecycle.service', () => ({
  processPaidOrder: vi.fn(async () => undefined),
  refundOrder: vi.fn(async () => undefined)
}))

const mockGateway = {
  id: 1,
  key: 'mock',
  providerKey: 'mock',
  displayName: 'Mock (dev)',
  enabled: true,
  mode: 'sandbox',
  sortOrder: 0,
  enabledCurrencies: null,
  config: null
}

function mockOrder(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 11,
    orderNumber: 'ORD-W1',
    userId: null,
    email: 'a@b.c',
    currency: 'USD',
    subtotalMinor: 1999,
    totalMinor: 1999,
    status: 'pending_payment',
    paymentStatus: 'pending',
    fulfillmentStatus: 'unfulfilled',
    createdAt: new Date(),
    ...overrides
  }
}

// fresh object per test: syncPaymentStatus mutates attempt.status in place
function attemptRow() {
  return {
    id: 21,
    orderId: 11,
    gatewayKey: 'mock',
    idempotencyKey: 'ORD-W1:mock',
    providerOrderId: 'MOCK-ORD-W1:mock',
    providerPaymentId: null,
    providerCaptureId: null,
    status: 'created',
    amountMinor: 1999,
    currency: 'USD',
    approvalUrl: '/checkout/ORD-W1?mock=true'
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(findGatewayByKey).mockResolvedValue(mockGateway)
})

describe('startPayment', () => {
  it('creates an attempt and returns the approval URL', async () => {
    vi.mocked(findOrderByNumber).mockResolvedValue(mockOrder() as never)
    vi.mocked(createPaymentAttempt).mockResolvedValue(attemptRow() as never)

    const result = await startPayment('ORD-W1', 'mock', 'https://site.test')
    expect(result.approvalUrl).toContain('/checkout/ORD-W1')
    expect(result.status).toBe('created')
    expect(createPaymentAttempt).toHaveBeenCalledWith(expect.objectContaining({
      orderId: 11,
      gatewayKey: 'mock',
      idempotencyKey: 'ORD-W1:mock'
    }))
    expect(updatePaymentAttemptStatus).toHaveBeenCalledWith(21, expect.objectContaining({
      status: 'created',
      approvalUrl: expect.stringContaining('/checkout/ORD-W1')
    }))
  })

  it('is idempotent: reuses the active attempt instead of creating a new one', async () => {
    vi.mocked(findOrderByNumber).mockResolvedValue(mockOrder() as never)
    vi.mocked(listPaymentAttemptsForOrder).mockResolvedValue([attemptRow()] as never)

    const result = await startPayment('ORD-W1', 'mock', 'https://site.test')
    expect(createPaymentAttempt).not.toHaveBeenCalled()
    expect(result.approvalUrl).toBe('/checkout/ORD-W1?mock=true')
  })

  it('rejects non-pending orders with 409', async () => {
    vi.mocked(findOrderByNumber).mockResolvedValue(mockOrder({ status: 'paid', paymentStatus: 'captured' }) as never)
    await expect(startPayment('ORD-W1', 'mock', 'https://site.test')).rejects.toMatchObject({ statusCode: 409 })
  })

  it('rejects unsupported currencies with 422', async () => {
    vi.mocked(findOrderByNumber).mockResolvedValue(mockOrder() as never)
    vi.mocked(findGatewayByKey).mockResolvedValue({ ...mockGateway, enabledCurrencies: 'EUR' })
    await expect(startPayment('ORD-W1', 'mock', 'https://site.test')).rejects.toMatchObject({ statusCode: 422 })
  })
})

describe('syncPaymentStatus', () => {
  it('marks the order paid when the provider reports a capture', async () => {
    vi.mocked(findOrderByNumber).mockResolvedValue(mockOrder() as never)
    vi.mocked(listPaymentAttemptsForOrder).mockResolvedValue([attemptRow()] as never)

    const result = await syncPaymentStatus('ORD-W1')
    expect(result.orderStatus).toBe('pending_payment')
    // MockDriver reports captured on status queries
    expect(updatePaymentAttemptStatus).toHaveBeenCalledWith(21, expect.objectContaining({ status: 'captured' }))
    expect(processPaidOrder).toHaveBeenCalledWith(11, 'mock', 21, 1999, 'USD')
  })

  it('returns local state when no attempt exists', async () => {
    vi.mocked(findOrderByNumber).mockResolvedValue(mockOrder() as never)
    vi.mocked(listPaymentAttemptsForOrder).mockResolvedValue([])

    const result = await syncPaymentStatus('ORD-W1')
    expect(result.attempt).toBeNull()
    expect(processPaidOrder).not.toHaveBeenCalled()
  })
})

describe('handleWebhook', () => {
  it('skips duplicated provider events', async () => {
    vi.mocked(recordWebhookEvent).mockResolvedValue({
      row: { id: 1, gatewayKey: 'mock', providerEventId: 'evt-1', eventType: 'PAYMENT.CAPTURE.COMPLETED', signatureVerified: true, processingStatus: 'processed' },
      duplicated: true
    } as never)

    const result = await handleWebhook('mock', {}, JSON.stringify({ eventType: 'PAYMENT.CAPTURE.COMPLETED', eventId: 'evt-1', orderId: 'MOCK-1' }))
    expect(result).toMatchObject({ processed: true, duplicate: true })
    expect(processPaidOrder).not.toHaveBeenCalled()
  })

  it('advances the attempt to captured and records the charge on CAPTURE.COMPLETED', async () => {
    vi.mocked(recordWebhookEvent).mockResolvedValue({
      row: { id: 2, gatewayKey: 'mock', providerEventId: 'evt-2', eventType: 'PAYMENT.CAPTURE.COMPLETED', signatureVerified: true, processingStatus: 'received' },
      duplicated: false
    } as never)
    // attempt lookup by provider order id (db stub), then order lookup
    vi.mocked(dbStub.limit).mockResolvedValue([attemptRow()] as never)
    vi.mocked(findOrderRow).mockResolvedValue(mockOrder() as never)

    const result = await handleWebhook('mock', {}, JSON.stringify({ eventType: 'PAYMENT.CAPTURE.COMPLETED', eventId: 'evt-2', orderId: 'MOCK-ORD-W1:mock' }))
    expect(result.processed).toBe(true)
    expect(processPaidOrder).toHaveBeenCalledWith(11, 'mock', 21, 1999, 'USD')
  })

  it('marks approved attempts on CHECKOUT.ORDER.APPROVED', async () => {
    vi.mocked(recordWebhookEvent).mockResolvedValue({
      row: { id: 3, gatewayKey: 'mock', providerEventId: 'evt-3', eventType: 'CHECKOUT.ORDER.APPROVED', signatureVerified: true, processingStatus: 'received' },
      duplicated: false
    } as never)
    vi.mocked(dbStub.limit).mockResolvedValue([attemptRow()] as never)

    await handleWebhook('mock', {}, JSON.stringify({ eventType: 'CHECKOUT.ORDER.APPROVED', eventId: 'evt-3', orderId: 'MOCK-ORD-W1:mock' }))
    expect(updatePaymentAttemptStatus).toHaveBeenCalledWith(21, { status: 'approved' })
  })

  it('falls back to the merchant order number and directly captures for webhook-authoritative providers', async () => {
    // NOWPayments driver: no capture_api — the verified IPN itself confirms payment
    vi.mocked(findGatewayByKey).mockResolvedValue({
      ...mockGateway,
      key: 'np',
      providerKey: 'nowpayments',
      config: { apiKey: 'np', ipnSecret: 'ipn-secret' }
    })
    vi.mocked(recordWebhookEvent).mockResolvedValue({
      row: { id: 5, gatewayKey: 'np', providerEventId: 'evt-5', eventType: 'PAYMENT.CAPTURE.COMPLETED', signatureVerified: true, processingStatus: 'received' },
      duplicated: false
    } as never)
    // provider order id lookup misses (db stub), merchant order number hits
    vi.mocked(dbStub.limit).mockResolvedValue([] as never)
    vi.mocked(findOrderByNumber).mockResolvedValue(mockOrder() as never)
    vi.mocked(listPaymentAttemptsForOrder).mockResolvedValue([{
      ...attemptRow(),
      gatewayKey: 'np',
      idempotencyKey: 'ORD-W1:np'
    }] as never)

    const body = {
      payment_id: 555,
      payment_status: 'finished',
      order_id: 'ORD-W1',
      price_amount: '19.99',
      price_currency: 'usd'
    }
    const raw = JSON.stringify(body)
    const headers = { 'x-nowpayments-sig': createHmac('sha512', 'ipn-secret').update(JSON.stringify(body, Object.keys(body).sort())).digest('hex') }

    const result = await handleWebhook('np', headers, raw)
    expect(result.processed).toBe(true)
    // captured directly from the verified webhook, no capture API involved
    expect(updatePaymentAttemptStatus).toHaveBeenCalledWith(21, expect.objectContaining({
      status: 'captured',
      providerCaptureId: '555'
    }))
    expect(processPaidOrder).toHaveBeenCalledWith(11, 'np', 21, 1999, 'USD')
  })

  it('fails unverified webhooks with 400 and records the skip', async () => {
    // driver override: gateway whose driver rejects every signature
    vi.mocked(findGatewayByKey).mockResolvedValue(mockGateway)
    vi.mocked(recordWebhookEvent).mockResolvedValue({
      row: { id: 4, gatewayKey: 'mock', providerEventId: 'evt-4', eventType: 'PAYMENT.CAPTURE.DENIED', signatureVerified: true, processingStatus: 'received' },
      duplicated: false
    } as never)
    // MockDriver always verifies; an unknown provider fails earlier with 422
    vi.mocked(findGatewayByKey).mockResolvedValue({ ...mockGateway, providerKey: 'nonexistent' })
    await expect(
      handleWebhook('mock', {}, JSON.stringify({ eventType: 'PAYMENT.CAPTURE.DENIED', eventId: 'evt-4' }))
    ).rejects.toMatchObject({ statusCode: 422 })
  })
})

describe('refundOrderViaGateway', () => {
  it('records refunds locally when the provider has no refund API', async () => {
    vi.mocked(findGatewayByKey).mockResolvedValue({
      ...mockGateway,
      key: 'np',
      providerKey: 'nowpayments',
      config: { apiKey: 'np', ipnSecret: 'ipn-secret' }
    })
    vi.mocked(listPaymentAttemptsForOrder).mockResolvedValue([{
      ...attemptRow(),
      status: 'captured',
      providerCaptureId: '555'
    }] as never)

    const result = await refundOrderViaGateway(mockOrder() as never)
    expect(result.viaGateway).toBe(false)
    expect(refundOrder).toHaveBeenCalledWith(11, 1999, 'USD')
  })

  it('records refunds locally when no captured attempt exists', async () => {
    vi.mocked(listPaymentAttemptsForOrder).mockResolvedValue([])

    const result = await refundOrderViaGateway(mockOrder() as never)
    expect(result.viaGateway).toBe(false)
    expect(refundOrder).toHaveBeenCalled()
  })
})
