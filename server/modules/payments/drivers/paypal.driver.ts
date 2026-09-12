import type {
  CaptureInput,
  CaptureResult,
  CreatePaymentInput,
  CreatePaymentResult,
  NormalizedPaymentError,
  PaymentGatewayDriver,
  PaymentState,
  PaymentStatusInput,
  PaymentStatusResult,
  RefundInput,
  RefundResult,
  WebhookVerificationResult
} from '../gateway-driver'

/* PayPal Checkout Orders v2 driver (commerce doc §9).
   Config keys: clientId, clientSecret, webhookId. baseUrl is derived
   from mode unless overridden via PAYPAL_BASE_URL in config.
   All POST calls send PayPal-Request-Id = local idempotency key. */

const SANDBOX_BASE = 'https://api-m.sandbox.paypal.com'
const LIVE_BASE = 'https://api-m.paypal.com'

const ZERO_DECIMAL_CURRENCIES = new Set(['JPY', 'KRW', 'VND', 'CLP'])

export function formatAmount(amountMinor: number, currency: string): string {
  const decimals = ZERO_DECIMAL_CURRENCIES.has(currency.toUpperCase()) ? 0 : 2
  return (amountMinor / 10 ** decimals).toFixed(decimals)
}

export function parseAmountToMinor(value: string, currency: string): number {
  const decimals = ZERO_DECIMAL_CURRENCIES.has(currency.toUpperCase()) ? 0 : 2
  return Math.round(Number(value) * 10 ** decimals)
}

interface TokenCacheEntry {
  token: string
  expiresAt: number
}

const tokenCache = new Map<string, TokenCacheEntry>()

export class PayPalDriver implements PaymentGatewayDriver {
  providerKey = 'paypal'

  private baseUrl(config: Record<string, string>, mode: string): string {
    if (config.PAYPAL_BASE_URL) return config.PAYPAL_BASE_URL.replace(/\/$/, '')
    return mode === 'live' ? LIVE_BASE : SANDBOX_BASE
  }

  private async getToken(config: Record<string, string>, mode: string): Promise<string> {
    const base = this.baseUrl(config, mode)
    const cacheKey = `${base}:${config.clientId ?? ''}`
    const cached = tokenCache.get(cacheKey)
    if (cached && cached.expiresAt > Date.now() + 30_000) {
      return cached.token
    }
    const credentials = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64')
    const response = await fetch(`${base}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: 'grant_type=client_credentials',
      signal: AbortSignal.timeout(15_000)
    })
    if (!response.ok) {
      throw new Error(`PayPal token request failed (${response.status})`)
    }
    const data = await response.json() as { access_token: string, expires_in: number }
    tokenCache.set(cacheKey, { token: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 })
    return data.access_token
  }

  private async request<T>(
    config: Record<string, string>,
    mode: string,
    method: 'GET' | 'POST',
    path: string,
    body?: unknown,
    requestId?: string
  ): Promise<T> {
    const token = await this.getToken(config, mode)
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
    if (requestId) headers['PayPal-Request-Id'] = requestId
    const response = await fetch(`${this.baseUrl(config, mode)}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(20_000)
    })
    const text = await response.text()
    const data = text ? JSON.parse(text) as T : {} as T
    if (!response.ok) {
      const detail = data as { message?: string, details?: Array<{ issue?: string }> }
      const issue = detail.details?.[0]?.issue ?? detail.message ?? `HTTP ${response.status}`
      const error = new Error(`PayPal ${path} failed: ${issue}`)
      ;(error as Error & { statusCode?: number }).statusCode = response.status
      throw error
    }
    return data
  }

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    const order = await this.request<{
      id: string
      links?: Array<{ rel: string, href: string }>
    }>(input.config, input.mode, 'POST', '/v2/checkout/orders', {
      intent: 'CAPTURE',
      purchase_units: [{
        reference_id: input.orderNumber,
        custom_id: input.orderNumber,
        amount: { currency_code: input.currency, value: formatAmount(input.amountMinor, input.currency) }
      }],
      application_context: {
        return_url: input.returnUrl,
        cancel_url: input.cancelUrl
      }
    }, input.idempotencyKey)
    const approvalUrl = order.links?.find(l => l.rel === 'approve' || l.rel === 'payer-action')?.href
    if (!approvalUrl) {
      throw new Error('PayPal order response missing approval link')
    }
    return { providerOrderId: order.id, approvalUrl }
  }

  async getPaymentStatus(input: PaymentStatusInput): Promise<PaymentStatusResult> {
    const order = await this.request<{
      id: string
      status: string
      purchase_units?: Array<{
        amount?: { value?: string, currency_code?: string }
        payments?: { captures?: Array<{ id: string, status: string, amount?: { value?: string, currency_code?: string } }> }
      }>
    }>(input.config, input.mode, 'GET', `/v2/checkout/orders/${encodeURIComponent(input.providerOrderId)}`)
    const capture = order.purchase_units?.[0]?.payments?.captures?.[0]
    const amount = order.purchase_units?.[0]?.amount
    return {
      providerOrderId: order.id,
      status: this.mapOrderStatus(order.status),
      providerCaptureId: capture ? capture.id : null,
      amountMinor: amount?.value ? parseAmountToMinor(amount.value, amount.currency_code ?? 'USD') : null,
      currency: amount?.currency_code ?? null
    }
  }

  private mapOrderStatus(status: string): PaymentState {
    switch (status) {
      case 'CREATED': return 'created'
      case 'SAVED':
      case 'APPROVED': return 'approved'
      case 'COMPLETED': return 'captured'
      case 'VOIDED': return 'canceled'
      default: return 'failed'
    }
  }

  async capturePayment(input: CaptureInput): Promise<CaptureResult> {
    const order = await this.request<{
      status: string
      purchase_units?: Array<{
        payments?: { captures?: Array<{ id: string, status: string, amount?: { value?: string, currency_code?: string } }> }
      }>
    }>(input.config, input.mode, 'POST',
      `/v2/checkout/orders/${encodeURIComponent(input.providerOrderId)}/capture`,
      {}, input.idempotencyKey)
    const capture = order.purchase_units?.[0]?.payments?.captures?.[0]
    return {
      providerCaptureId: capture?.id ?? '',
      status: order.status === 'COMPLETED' ? 'completed' : capture?.status === 'PENDING' ? 'pending' : 'failed',
      amountMinor: capture?.amount?.value ? parseAmountToMinor(capture.amount.value, capture.amount.currency_code ?? 'USD') : null,
      currency: capture?.amount?.currency_code ?? null
    }
  }

  async refundPayment(input: RefundInput): Promise<RefundResult> {
    const body = input.amountMinor === null
      ? {}
      : { amount: { currency_code: input.currency, value: formatAmount(input.amountMinor, input.currency) } }
    const refund = await this.request<{ id: string, status: string }>(
      input.config, input.mode, 'POST',
      `/v2/payments/captures/${encodeURIComponent(input.providerCaptureId)}/refund`,
      body, input.idempotencyKey)
    return {
      providerRefundId: refund.id,
      status: refund.status === 'COMPLETED' ? 'completed' : refund.status === 'PENDING' ? 'pending' : 'failed'
    }
  }

  async verifyWebhook(headers: Record<string, string>, body: string, config: Record<string, string>): Promise<WebhookVerificationResult> {
    const event = JSON.parse(body) as {
      id?: string
      event_type?: string
      resource?: {
        id?: string
        supplementary_data?: { related_ids?: { order_id?: string } }
        purchase_units?: Array<{ payments?: { captures?: Array<{ id: string }> } }>
      }
    }
    const header = (name: string) => headers[name] ?? headers[name.replace(/-/g, '_').toUpperCase()] ?? ''
    const verify = await this.request<{ verification_status: string }>(config, config.mode ?? 'sandbox', 'POST',
      '/v1/notifications/verify-webhook-signature', {
        auth_algo: header('paypal-auth-algo'),
        cert_url: header('paypal-cert-url'),
        transmission_id: header('paypal-transmission-id'),
        transmission_sig: header('paypal-transmission-sig'),
        transmission_time: header('paypal-transmission-time'),
        webhook_id: config.webhookId,
        webhook_event: JSON.parse(body)
      })
    const eventType = event.event_type ?? 'UNKNOWN'
    const isCaptureEvent = eventType.startsWith('PAYMENT.CAPTURE.')
    return {
      verified: verify.verification_status === 'SUCCESS',
      eventType,
      providerEventId: event.id ?? `unknown-${Date.now()}`,
      providerOrderId: isCaptureEvent
        ? event.resource?.supplementary_data?.related_ids?.order_id ?? null
        : event.resource?.id ?? null,
      providerCaptureId: isCaptureEvent ? event.resource?.id ?? null : null,
      merchantOrderNumber: null,
      amountMinor: null,
      currency: null
    }
  }

  normalizeError(error: unknown): NormalizedPaymentError {
    const message = error instanceof Error ? error.message : String(error)
    const statusCode = (error as Error & { statusCode?: number }).statusCode
    if (statusCode === 422 || statusCode === 400) {
      return { code: 'gateway_rejected', retryable: false, message }
    }
    if (statusCode === 401 || statusCode === 403) {
      return { code: 'gateway_auth_failed', retryable: false, message }
    }
    if (statusCode !== undefined && statusCode >= 500) {
      return { code: 'gateway_unavailable', retryable: true, message }
    }
    const name = error instanceof Error ? error.name : ''
    if (name === 'TimeoutError' || name === 'AbortError') {
      return { code: 'gateway_timeout', retryable: true, message }
    }
    return { code: 'gateway_error', retryable: true, message }
  }

  supports(capability: string): boolean {
    return ['create', 'capture', 'capture_api', 'refund', 'webhook', 'redirect', 'multi_currency', 'sandbox'].includes(capability)
  }
}
