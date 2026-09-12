import { afterEach, describe, expect, it, vi } from 'vitest'
import { MockDriver } from '../../server/modules/payments/drivers/mock.driver'
import { PayPalDriver, formatAmount, parseAmountToMinor } from '../../server/modules/payments/drivers/paypal.driver'

describe('MockDriver', () => {
  it('createPayment returns a site-relative approval URL carrying the order', async () => {
    const driver = new MockDriver()
    const result = await driver.createPayment({
      orderNumber: 'ORD-TEST1',
      amountMinor: 1999,
      currency: 'USD',
      customerEmail: null,
      returnUrl: 'https://x.test/r',
      cancelUrl: 'https://x.test/c',
      webhookUrl: 'https://x.test/w',
      idempotencyKey: 'ORD-TEST1:mock',
      config: {},
      mode: 'sandbox'
    })
    expect(result.providerOrderId).toContain('ORD-TEST1')
    expect(result.approvalUrl).toContain('/checkout/ORD-TEST1')
  })

  it('capturePayment completes and refundPayment completes', async () => {
    const driver = new MockDriver()
    const capture = await driver.capturePayment({ providerOrderId: 'MOCK-1', idempotencyKey: 'k:capture', config: {}, mode: 'sandbox' })
    expect(capture.status).toBe('completed')
    const refund = await driver.refundPayment({ providerCaptureId: 'C1', amountMinor: null, currency: 'USD', idempotencyKey: 'k:refund', config: {}, mode: 'sandbox' })
    expect(refund.status).toBe('completed')
  })

  it('verifyWebhook trusts mock payloads and extracts the event type', async () => {
    const driver = new MockDriver()
    const result = await driver.verifyWebhook({}, JSON.stringify({ eventType: 'PAYMENT.CAPTURE.COMPLETED', eventId: 'evt-1', orderId: 'MOCK-1' }), {})
    expect(result.verified).toBe(true)
    expect(result.eventType).toBe('PAYMENT.CAPTURE.COMPLETED')
    expect(result.providerEventId).toBe('evt-1')
    expect(result.providerOrderId).toBe('MOCK-1')
  })

  it('supports create/capture/refund/webhook/sandbox but not redirect', () => {
    const driver = new MockDriver()
    expect(driver.supports('refund')).toBe(true)
    expect(driver.supports('redirect')).toBe(false)
  })
})

describe('PayPal amount formatting', () => {
  it('formats two-decimal currencies from minor units', () => {
    expect(formatAmount(1999, 'USD')).toBe('19.99')
    expect(formatAmount(100, 'EUR')).toBe('1.00')
    expect(formatAmount(0, 'USD')).toBe('0.00')
  })

  it('formats zero-decimal currencies without decimals', () => {
    expect(formatAmount(1000, 'JPY')).toBe('1000')
    expect(formatAmount(50000, 'KRW')).toBe('50000')
  })

  it('roundtrips minor units', () => {
    for (const [minor, currency] of [[1999, 'USD'], [123456, 'EUR'], [7, 'JPY']] as Array<[number, string]>) {
      expect(parseAmountToMinor(formatAmount(minor, currency), currency)).toBe(minor)
    }
  })
})

describe('PayPal normalizeError', () => {
  const driver = new PayPalDriver()

  it('marks 4xx rejections as non-retryable', () => {
    const err = Object.assign(new Error('rejected'), { statusCode: 422 })
    const normalized = driver.normalizeError(err)
    expect(normalized.retryable).toBe(false)
    expect(normalized.code).toBe('gateway_rejected')
  })

  it('marks auth failures as non-retryable', () => {
    const normalized = driver.normalizeError(Object.assign(new Error('bad creds'), { statusCode: 401 }))
    expect(normalized.code).toBe('gateway_auth_failed')
    expect(normalized.retryable).toBe(false)
  })

  it('marks 5xx as retryable', () => {
    const normalized = driver.normalizeError(Object.assign(new Error('boom'), { statusCode: 503 }))
    expect(normalized.code).toBe('gateway_unavailable')
    expect(normalized.retryable).toBe(true)
  })

  it('marks timeouts as retryable', () => {
    const err = new Error('timed out')
    err.name = 'TimeoutError'
    expect(driver.normalizeError(err).code).toBe('gateway_timeout')
    expect(driver.normalizeError(new Error('other')).retryable).toBe(true)
  })
})

describe('PayPal verifyWebhook event extraction', () => {
  const driver = new PayPalDriver()

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function stubVerify(status: string) {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ verification_status: status }),
      json: async () => ({ access_token: 'test-token', expires_in: 3600 })
    })))
  }

  it('extracts the order id from capture events via related ids', async () => {
    stubVerify('SUCCESS')
    const body = JSON.stringify({
      id: 'WH-1',
      event_type: 'PAYMENT.CAPTURE.COMPLETED',
      resource: {
        id: 'CAP-1',
        supplementary_data: { related_ids: { order_id: 'PO-1' } }
      }
    })
    const result = await driver.verifyWebhook({ 'paypal-auth-algo': 'SHA256withRSA' }, body, { clientId: 'c', clientSecret: 's', webhookId: 'w' })
    expect(result.verified).toBe(true)
    expect(result.providerEventId).toBe('WH-1')
    expect(result.providerOrderId).toBe('PO-1')
    expect(result.providerCaptureId).toBe('CAP-1')
  })

  it('extracts the order id directly from checkout order events', async () => {
    stubVerify('SUCCESS')
    const body = JSON.stringify({
      id: 'WH-2',
      event_type: 'CHECKOUT.ORDER.APPROVED',
      resource: { id: 'PO-2' }
    })
    const result = await driver.verifyWebhook({}, body, { clientId: 'c', clientSecret: 's', webhookId: 'w' })
    expect(result.eventType).toBe('CHECKOUT.ORDER.APPROVED')
    expect(result.providerOrderId).toBe('PO-2')
    expect(result.providerCaptureId).toBeNull()
  })

  it('reports verified=false when PayPal rejects the signature', async () => {
    stubVerify('FAILURE')
    const body = JSON.stringify({ id: 'WH-3', event_type: 'CHECKOUT.ORDER.APPROVED', resource: { id: 'PO-3' } })
    const result = await driver.verifyWebhook({}, body, { clientId: 'c', clientSecret: 's', webhookId: 'w' })
    expect(result.verified).toBe(false)
  })
})
