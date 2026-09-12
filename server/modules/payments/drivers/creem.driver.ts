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
import { hmacHex, requestJson, safeEqualHex } from './shared'

/* Creem Merchant-of-Record gateway: hosted checkout creation, checkout
   status polling, HMAC-SHA256 webhooks (creem-signature header).
   Config: apiKey, productId, webhookSecret. CREEM_BASE_URL overrides
   the environment base (test-api.creem.io for sandbox). */

export class CreemDriver implements PaymentGatewayDriver {
  providerKey = 'creem'

  private baseUrl(config: Record<string, string>, mode: string): string {
    if (config.CREEM_BASE_URL) return config.CREEM_BASE_URL.replace(/\/$/, '')
    return mode === 'live' ? 'https://api.creem.io' : 'https://test-api.creem.io'
  }

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    const checkout = await requestJson<{ id: string, checkout_url: string }>({
      method: 'POST',
      url: `${this.baseUrl(input.config, input.mode)}/v1/checkouts`,
      headers: { 'x-api-key': input.config.apiKey ?? '', 'Content-Type': 'application/json' },
      body: {
        product_id: input.config.productId,
        success_url: input.returnUrl,
        metadata: { order_number: input.orderNumber }
      }
    })
    return { providerOrderId: checkout.id, approvalUrl: checkout.checkout_url }
  }

  private mapCheckoutStatus(status: string): PaymentStatusResult['status'] {
    switch (status) {
      case 'completed': return 'captured'
      case 'expired': return 'canceled'
      default: return 'created'
    }
  }

  private async fetchCheckout(config: Record<string, string>, mode: string, checkoutId: string): Promise<{
    id: string
    status: string
    order?: { id?: string } | null
  }> {
    return requestJson({
      method: 'GET',
      url: `${this.baseUrl(config, mode)}/v1/checkouts/${encodeURIComponent(checkoutId)}`,
      headers: { 'x-api-key': config.apiKey ?? '' }
    })
  }

  async getPaymentStatus(input: PaymentStatusInput): Promise<PaymentStatusResult> {
    const checkout = await this.fetchCheckout(input.config, input.mode, input.providerOrderId)
    return {
      providerOrderId: checkout.id,
      status: this.mapCheckoutStatus(checkout.status),
      providerCaptureId: checkout.order?.id ?? null,
      amountMinor: null,
      currency: null
    }
  }

  async capturePayment(input: CaptureInput): Promise<CaptureResult> {
    const checkout = await this.fetchCheckout(input.config, input.mode, input.providerOrderId)
    if (checkout.status !== 'completed') {
      return { providerCaptureId: '', status: 'failed', amountMinor: null, currency: null }
    }
    return {
      providerCaptureId: checkout.order?.id ?? checkout.id,
      status: 'completed',
      amountMinor: null,
      currency: null
    }
  }

  async refundPayment(_input: RefundInput): Promise<RefundResult> {
    throw new Error('Creem refunds are handled in the Creem dashboard; refund events arrive via webhook')
  }

  async verifyWebhook(headers: Record<string, string>, body: string, config: Record<string, string>): Promise<WebhookVerificationResult> {
    const signature = headers['creem-signature'] ?? headers['Creem-Signature'] ?? ''
    const expected = hmacHex('sha256', config.webhookSecret ?? '', body)
    if (!signature || !safeEqualHex(signature, expected)) {
      throw Object.assign(new Error('Creem webhook signature mismatch'), { statusCode: 400 })
    }
    const parsed = JSON.parse(body) as {
      id?: string
      eventType?: string
      object?: {
        id?: string
        metadata?: Record<string, unknown>
        order?: { id?: string } | null
      }
    }
    const eventType = parsed.eventType ?? 'unknown'
    let internalEvent = 'IGNORED'
    if (eventType === 'checkout.completed' || eventType === 'payment.succeeded') {
      internalEvent = 'PAYMENT.CAPTURE.COMPLETED'
    } else if (eventType === 'refund.succeeded') {
      internalEvent = 'PAYMENT.CAPTURE.REFUNDED'
    }
    const metadata = parsed.object?.metadata
    const orderNumber = metadata && typeof metadata.order_number === 'string' ? metadata.order_number : null
    return {
      verified: true,
      eventType: internalEvent,
      providerEventId: parsed.id ?? `creem-${Date.now()}`,
      providerOrderId: parsed.object?.id ?? null,
      providerCaptureId: parsed.object?.order?.id ?? null,
      merchantOrderNumber: orderNumber,
      amountMinor: null,
      currency: null
    }
  }

  normalizeError(error: unknown): NormalizedPaymentError {
    const message = error instanceof Error ? error.message : String(error)
    const statusCode = (error as Error & { statusCode?: number }).statusCode
    if (statusCode === 400 || statusCode === 401 || statusCode === 404 || statusCode === 422) {
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
    return ['create', 'capture', 'capture_api', 'webhook', 'redirect', 'sandbox'].includes(capability)
  }
}
