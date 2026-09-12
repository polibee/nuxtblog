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

/* Lemon Squeezy Merchant-of-Record gateway: JSON:API hosted checkouts
   with custom_price, checkout status polling, HMAC-SHA256 webhooks
   (X-Signature header). Config: apiKey, storeId, variantId, webhookSecret. */

const DEFAULT_BASE = 'https://api.lemonsqueezy.com/v1'

function merchantNumberFromCustom(custom: unknown): string | null {
  if (typeof custom === 'string') return custom
  if (Array.isArray(custom)) return typeof custom[0] === 'string' ? custom[0] : null
  if (custom && typeof custom === 'object') {
    const value = (custom as Record<string, unknown>).order_number
    return typeof value === 'string' ? value : null
  }
  return null
}

export class LemonSqueezyDriver implements PaymentGatewayDriver {
  providerKey = 'lemonsqueezy'

  private authHeaders(config: Record<string, string>): Record<string, string> {
    return {
      'Authorization': `Bearer ${config.apiKey ?? ''}`,
      'Accept': 'application/vnd.api+json',
      'Content-Type': 'application/vnd.api+json'
    }
  }

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    const checkout = await requestJson<{
      data: { id: string, attributes: { url: string } }
    }>({
      method: 'POST',
      url: `${(input.config.LS_BASE_URL ?? DEFAULT_BASE).replace(/\/$/, '')}/checkouts`,
      headers: this.authHeaders(input.config),
      body: {
        data: {
          type: 'checkouts',
          attributes: {
            custom_price: [input.currency, input.amountMinor],
            product_options: { redirect_url: input.returnUrl },
            checkout_data: { custom: [input.orderNumber] }
          },
          relationships: {
            store: { data: { type: 'stores', id: input.config.storeId } },
            variant: { data: { type: 'variants', id: input.config.variantId } }
          }
        }
      }
    })
    return { providerOrderId: checkout.data.id, approvalUrl: checkout.data.attributes.url }
  }

  private mapCheckoutStatus(status: string): PaymentStatusResult['status'] {
    switch (status) {
      case 'paid': return 'captured'
      case 'expired': return 'canceled'
      default: return 'created'
    }
  }

  private async fetchCheckout(config: Record<string, string>, checkoutId: string): Promise<{
    id: string
    attributes: { status: string, total?: number, currency?: string, order_id?: number }
  }> {
    return requestJson({
      method: 'GET',
      url: `${(config.LS_BASE_URL ?? DEFAULT_BASE).replace(/\/$/, '')}/checkouts/${encodeURIComponent(checkoutId)}`,
      headers: this.authHeaders(config)
    })
  }

  async getPaymentStatus(input: PaymentStatusInput): Promise<PaymentStatusResult> {
    const checkout = await this.fetchCheckout(input.config, input.providerOrderId)
    return {
      providerOrderId: checkout.id,
      status: this.mapCheckoutStatus(checkout.attributes.status),
      providerCaptureId: checkout.attributes.order_id ? String(checkout.attributes.order_id) : null,
      amountMinor: checkout.attributes.total ?? null,
      currency: checkout.attributes.currency ?? null
    }
  }

  async capturePayment(input: CaptureInput): Promise<CaptureResult> {
    const checkout = await this.fetchCheckout(input.config, input.providerOrderId)
    if (checkout.attributes.status !== 'paid') {
      return { providerCaptureId: '', status: 'failed', amountMinor: null, currency: null }
    }
    return {
      providerCaptureId: checkout.attributes.order_id ? String(checkout.attributes.order_id) : checkout.id,
      status: 'completed',
      amountMinor: checkout.attributes.total ?? null,
      currency: checkout.attributes.currency ?? null
    }
  }

  async refundPayment(_input: RefundInput): Promise<RefundResult> {
    throw new Error('Lemon Squeezy refunds are handled in the dashboard; refund events arrive via webhook')
  }

  async verifyWebhook(headers: Record<string, string>, body: string, config: Record<string, string>): Promise<WebhookVerificationResult> {
    const signature = headers['x-signature'] ?? headers['X-Signature'] ?? ''
    const expected = hmacHex('sha256', config.webhookSecret ?? '', body)
    if (!signature || !safeEqualHex(signature, expected)) {
      throw Object.assign(new Error('Lemon Squeezy webhook signature mismatch'), { statusCode: 400 })
    }
    const parsed = JSON.parse(body) as {
      meta?: { event_name?: string, custom_data?: unknown }
      data?: { id?: string, attributes?: { total?: number, currency?: string, order_id?: number } }
    }
    const eventName = parsed.meta?.event_name ?? 'unknown'
    let internalEvent = 'IGNORED'
    if (eventName === 'order_created') internalEvent = 'PAYMENT.CAPTURE.COMPLETED'
    else if (eventName === 'order_refunded') internalEvent = 'PAYMENT.CAPTURE.REFUNDED'
    // LS amounts are already minor units (cents)
    return {
      verified: true,
      eventType: internalEvent,
      providerEventId: parsed.data?.id ? `${eventName}:${parsed.data.id}` : `ls-${Date.now()}`,
      providerOrderId: parsed.data?.id ?? null,
      providerCaptureId: parsed.data?.id ?? null,
      merchantOrderNumber: merchantNumberFromCustom(parsed.meta?.custom_data),
      amountMinor: parsed.data?.attributes?.total ?? null,
      currency: parsed.data?.attributes?.currency ?? null
    }
  }

  normalizeError(error: unknown): NormalizedPaymentError {
    const message = error instanceof Error ? error.message : String(error)
    const statusCode = (error as Error & { statusCode?: number }).statusCode
    if (statusCode === 400 || statusCode === 404 || statusCode === 422) {
      return { code: 'gateway_rejected', retryable: false, message }
    }
    if (statusCode === 401 || statusCode === 403) {
      return { code: 'gateway_auth_failed', retryable: false, message }
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
