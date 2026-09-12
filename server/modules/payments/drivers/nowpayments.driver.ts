import type {
  CaptureInput,
  CaptureResult,
  CreatePaymentInput,
  CreatePaymentResult,
  NormalizedPaymentError,
  PaymentGatewayDriver,
  PaymentStatusInput,
  PaymentStatusResult,
  RefundInput,
  RefundResult,
  WebhookVerificationResult
} from '../gateway-driver'
import { formatAmount, hmacHex, parseAmountToMinor, requestJson, safeEqualHex } from './shared'

/* NOWPayments crypto gateway: fiat-priced invoices, IPN webhooks.
   Config: apiKey, ipnSecret. NOWPAYMENTS_BASE_URL overrides the API base.
   Status/capture APIs require a separate JWT login, so this driver is
   webhook-authoritative (supports('capture_api') === false). */

const DEFAULT_BASE = 'https://api.nowpayments.io/v1'

function deepSortedStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(deepSortedStringify).join(',')}]`
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${JSON.stringify(k)}:${deepSortedStringify(v)}`)
    return `{${entries.join(',')}}`
  }
  return JSON.stringify(value)
}

function signIpn(payload: Record<string, unknown>, ipnSecret: string): string[] {
  // official sample: JSON.stringify(params, Object.keys(params).sort())
  const topLevelSorted = JSON.stringify(payload, Object.keys(payload).sort())
  // community/robust variant: recursively key-sorted compact JSON
  return [hmacHex('sha512', ipnSecret, topLevelSorted), hmacHex('sha512', ipnSecret, deepSortedStringify(payload))]
}

export class NowPaymentsDriver implements PaymentGatewayDriver {
  providerKey = 'nowpayments'

  private baseUrl(config: Record<string, string>): string {
    return (config.NOWPAYMENTS_BASE_URL ?? DEFAULT_BASE).replace(/\/$/, '')
  }

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    const invoice = await requestJson<{ id: string, invoice_url: string }>({
      method: 'POST',
      url: `${this.baseUrl(input.config)}/invoice`,
      headers: { 'x-api-key': input.config.apiKey ?? '', 'Content-Type': 'application/json' },
      body: {
        price_amount: Number(formatAmount(input.amountMinor, input.currency)),
        price_currency: input.currency.toLowerCase(),
        order_id: input.orderNumber,
        order_description: `Order ${input.orderNumber}`,
        ipn_callback_url: input.webhookUrl,
        success_url: input.returnUrl,
        cancel_url: input.cancelUrl
      }
    })
    return { providerOrderId: invoice.id, approvalUrl: invoice.invoice_url }
  }

  async getPaymentStatus(_input: PaymentStatusInput): Promise<PaymentStatusResult> {
    throw new Error('NOWPayments status API requires a JWT login; payment state is IPN-driven')
  }

  async capturePayment(_input: CaptureInput): Promise<CaptureResult> {
    throw new Error('NOWPayments is webhook-authoritative; no server-side capture API')
  }

  async refundPayment(_input: RefundInput): Promise<RefundResult> {
    throw new Error('NOWPayments refunds are handled in the dashboard; refund events arrive via IPN')
  }

  async verifyWebhook(headers: Record<string, string>, body: string, config: Record<string, string>): Promise<WebhookVerificationResult> {
    const signature = headers['x-nowpayments-sig'] ?? headers['X-Nowpayments-Sig'] ?? ''
    const payload = JSON.parse(body) as Record<string, unknown>
    if (!signature || !config.ipnSecret) {
      throw Object.assign(new Error('NOWPayments IPN secret not configured'), { statusCode: 400 })
    }
    const candidates = signIpn(payload, config.ipnSecret)
    const matched = candidates.some(candidate => safeEqualHex(signature, candidate))
    if (!matched) {
      throw Object.assign(new Error('NOWPayments IPN signature mismatch'), { statusCode: 400 })
    }
    const paymentId = typeof payload.payment_id !== 'undefined' ? String(payload.payment_id) : null
    const status = typeof payload.payment_status === 'string' ? payload.payment_status : 'unknown'
    let internalEvent = 'IGNORED'
    if (status === 'finished' || status === 'confirmed') internalEvent = 'PAYMENT.CAPTURE.COMPLETED'
    else if (status === 'refunded') internalEvent = 'PAYMENT.CAPTURE.REFUNDED'
    else if (status === 'failed' || status === 'expired') internalEvent = 'PAYMENT.CAPTURE.DENIED'
    const priceCurrency = typeof payload.price_currency === 'string' ? payload.price_currency : null
    const priceAmount = typeof payload.price_amount === 'string' || typeof payload.price_amount === 'number'
      ? parseAmountToMinor(payload.price_amount, priceCurrency ?? 'USD')
      : null
    return {
      verified: true,
      eventType: internalEvent,
      providerEventId: `${paymentId ?? 'np'}:${status}:${payload.created_at ?? payload.purchase_id ?? Date.now()}`,
      providerOrderId: paymentId,
      providerCaptureId: paymentId,
      merchantOrderNumber: typeof payload.order_id === 'string' ? payload.order_id : null,
      amountMinor: priceAmount,
      currency: priceCurrency ? priceCurrency.toUpperCase() : null
    }
  }

  normalizeError(error: unknown): NormalizedPaymentError {
    const message = error instanceof Error ? error.message : String(error)
    const statusCode = (error as Error & { statusCode?: number }).statusCode
    if (statusCode === 400 || statusCode === 401 || statusCode === 422) {
      return { code: statusCode === 401 ? 'gateway_auth_failed' : 'gateway_rejected', retryable: false, message }
    }
    if (statusCode !== undefined && statusCode >= 500) {
      return { code: 'gateway_unavailable', retryable: true, message }
    }
    if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
      return { code: 'gateway_timeout', retryable: true, message }
    }
    return { code: 'gateway_error', retryable: true, message }
  }

  supports(capability: string): boolean {
    return ['create', 'capture', 'webhook', 'redirect', 'sandbox'].includes(capability)
  }
}
