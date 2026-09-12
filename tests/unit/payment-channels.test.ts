import { createHmac } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { XcashDriver } from '../../server/modules/payments/drivers/xcash.driver'
import { CreemDriver } from '../../server/modules/payments/drivers/creem.driver'
import { LemonSqueezyDriver } from '../../server/modules/payments/drivers/lemonsqueezy.driver'
import { NowPaymentsDriver } from '../../server/modules/payments/drivers/nowpayments.driver'
import {
  PROVIDER_TEMPLATES,
  validateProviderConfig
} from '../../server/modules/payments/provider-registry'

function hmac(algorithm: 'sha256' | 'sha512', secret: string, message: string): string {
  return createHmac(algorithm, secret).update(message).digest('hex')
}

describe('provider registry', () => {
  it('exposes every registered channel', () => {
    const keys = PROVIDER_TEMPLATES.map(t => t.providerKey)
    for (const required of ['mock', 'paypal', 'creem', 'lemonsqueezy', 'nowpayments', 'xcash', 'waffo']) {
      expect(keys).toContain(required)
    }
  })

  it('validates required config fields per provider', () => {
    const missing = validateProviderConfig('creem', { apiKey: 'k' })
    expect(missing.ok).toBe(false)
    expect(missing.message).toContain('Product ID')

    const complete = validateProviderConfig('creem', { apiKey: 'k', productId: 'prod_1', webhookSecret: 's' })
    expect(complete.ok).toBe(true)
  })

  it('rejects unknown providers', () => {
    expect(validateProviderConfig('nonexistent', {}).ok).toBe(false)
  })
})

describe('Xcash driver', () => {
  const driver = new XcashDriver()
  const config = { appid: 'XC-TEST', hmacKey: 'secret-key' }

  function signedHeaders(body: string): Record<string, string> {
    const timestamp = '1700000000'
    const nonce = 'nonce-1'
    return {
      'xc-appid': 'XC-TEST',
      'xc-timestamp': timestamp,
      'xc-nonce': nonce,
      'xc-signature': hmac('sha256', config.hmacKey, `${nonce}${timestamp}${body}`)
    }
  }

  it('accepts correctly signed invoice webhooks and maps them to capture completed', async () => {
    const body = JSON.stringify({
      type: 'invoice',
      data: { sys_no: 'INV1', out_no: 'ORD-1', hash: '0xabc', confirmed: true }
    })
    const result = await driver.verifyWebhook(signedHeaders(body), body, config)
    expect(result.verified).toBe(true)
    expect(result.eventType).toBe('PAYMENT.CAPTURE.COMPLETED')
    expect(result.merchantOrderNumber).toBe('ORD-1')
    expect(result.providerOrderId).toBe('INV1')
    expect(result.providerCaptureId).toBe('0xabc')
  })

  it('ignores deposit webhooks without state change', async () => {
    const body = JSON.stringify({ type: 'deposit', data: { sys_no: 'DXC1' } })
    const result = await driver.verifyWebhook(signedHeaders(body), body, config)
    expect(result.verified).toBe(true)
    expect(result.eventType).toBe('IGNORED')
  })

  it('rejects tampered signatures', async () => {
    const body = JSON.stringify({ type: 'invoice', data: { sys_no: 'INV1' } })
    const headers = signedHeaders(body)
    headers['xc-signature'] = '0'.repeat(64)
    await expect(driver.verifyWebhook(headers, body, config)).rejects.toMatchObject({ statusCode: 400 })
  })

  it('does not support API refunds or webhooks-less flow', () => {
    expect(driver.supports('refund')).toBe(false)
    expect(driver.supports('capture_api')).toBe(true)
  })
})

describe('Creem driver', () => {
  const driver = new CreemDriver()
  const config = { apiKey: 'ck', productId: 'prod_1', webhookSecret: 'wsec' }

  function signed(body: string): Record<string, string> {
    return { 'creem-signature': hmac('sha256', config.webhookSecret, body) }
  }

  it('maps checkout.completed to capture completed with merchant order number', async () => {
    const body = JSON.stringify({
      id: 'wh-1',
      eventType: 'checkout.completed',
      object: { id: 'ch_1', metadata: { order_number: 'ORD-9' }, order: { id: 'ord_1' } }
    })
    const result = await driver.verifyWebhook(signed(body), body, config)
    expect(result.eventType).toBe('PAYMENT.CAPTURE.COMPLETED')
    expect(result.merchantOrderNumber).toBe('ORD-9')
    expect(result.providerCaptureId).toBe('ord_1')
  })

  it('maps refund.succeeded to capture refunded', async () => {
    const body = JSON.stringify({
      id: 'wh-2',
      eventType: 'refund.succeeded',
      object: { id: 're_1', metadata: { order_number: 'ORD-9' } }
    })
    const result = await driver.verifyWebhook(signed(body), body, config)
    expect(result.eventType).toBe('PAYMENT.CAPTURE.REFUNDED')
  })

  it('rejects invalid signatures', async () => {
    const body = JSON.stringify({ id: 'wh-3', eventType: 'checkout.completed', object: {} })
    await expect(driver.verifyWebhook({ 'creem-signature': 'nope' }, body, config)).rejects.toMatchObject({ statusCode: 400 })
  })
})

describe('Lemon Squeezy driver', () => {
  const driver = new LemonSqueezyDriver()
  const config = { apiKey: 'ls', storeId: '1', variantId: '2', webhookSecret: 's' }

  function signed(body: string): Record<string, string> {
    return { 'x-signature': hmac('sha256', config.webhookSecret, body) }
  }

  it('maps order_created to capture completed with cent amounts as-is', async () => {
    const body = JSON.stringify({
      meta: { event_name: 'order_created', custom_data: ['ORD-5'] },
      data: { id: 'co_1', attributes: { total: 1999, currency: 'USD', order_id: 77 } }
    })
    const result = await driver.verifyWebhook(signed(body), body, config)
    expect(result.eventType).toBe('PAYMENT.CAPTURE.COMPLETED')
    expect(result.merchantOrderNumber).toBe('ORD-5')
    expect(result.amountMinor).toBe(1999)
    expect(result.currency).toBe('USD')
  })

  it('reads custom_data objects too', async () => {
    const body = JSON.stringify({
      meta: { event_name: 'order_created', custom_data: { order_number: 'ORD-6' } },
      data: { id: 'co_2', attributes: {} }
    })
    const result = await driver.verifyWebhook(signed(body), body, config)
    expect(result.merchantOrderNumber).toBe('ORD-6')
  })

  it('rejects invalid signatures', async () => {
    const body = JSON.stringify({ meta: { event_name: 'order_created' }, data: { id: 'co_3' } })
    await expect(driver.verifyWebhook({ 'x-signature': 'bad' }, body, config)).rejects.toMatchObject({ statusCode: 400 })
  })
})

describe('NOWPayments driver', () => {
  const driver = new NowPaymentsDriver()
  const config = { apiKey: 'np', ipnSecret: 'ipn-secret' }

  function signed(body: Record<string, unknown>): Record<string, string> {
    // official sample: JSON.stringify(params, Object.keys(params).sort())
    const signature = hmac('sha512', config.ipnSecret, JSON.stringify(body, Object.keys(body).sort()))
    return { 'x-nowpayments-sig': signature }
  }

  it('verifies the official sorted-key IPN signature and maps finished → completed', async () => {
    const body = {
      payment_id: 12345,
      payment_status: 'finished',
      order_id: 'ORD-7',
      price_amount: '19.99',
      price_currency: 'usd',
      actually_paid: 0.001
    }
    const result = await driver.verifyWebhook(signed(body), JSON.stringify(body), config)
    expect(result.verified).toBe(true)
    expect(result.eventType).toBe('PAYMENT.CAPTURE.COMPLETED')
    expect(result.merchantOrderNumber).toBe('ORD-7')
    expect(result.amountMinor).toBe(1999)
    expect(result.currency).toBe('USD')
  })

  it('maps refunded and failed statuses', async () => {
    const refunded = { payment_id: 1, payment_status: 'refunded', order_id: 'ORD-8' }
    const failed = { payment_id: 2, payment_status: 'failed', order_id: 'ORD-8' }
    expect((await driver.verifyWebhook(signed(refunded), JSON.stringify(refunded), config)).eventType)
      .toBe('PAYMENT.CAPTURE.REFUNDED')
    expect((await driver.verifyWebhook(signed(failed), JSON.stringify(failed), config)).eventType)
      .toBe('PAYMENT.CAPTURE.DENIED')
  })

  it('is webhook-authoritative (no capture_api) and rejects bad signatures', async () => {
    expect(driver.supports('capture_api')).toBe(false)
    await expect(driver.verifyWebhook({ 'x-nowpayments-sig': 'x'.repeat(128) }, '{"a":1}', config))
      .rejects.toMatchObject({ statusCode: 400 })
  })
})
