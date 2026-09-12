import { randomUUID } from 'node:crypto'
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

/* Xcash crypto gateway (docs/xcash.md): signed /v1/invoice creation,
   public status query, HMAC-SHA256 webhooks (headers XC-*).
   Config: appid, hmacKey. baseUrl override via XCASH_BASE_URL. */

const DEFAULT_BASE = 'https://pay.xca.sh'

interface XcashInvoice {
  sys_no: string
  out_no: string
  status: string
  pay_url: string
  amount?: string
  currency?: string
  payment?: { hash?: string } | null
}

export class XcashDriver implements PaymentGatewayDriver {
  providerKey = 'xcash'

  private baseUrl(config: Record<string, string>): string {
    return (config.XCASH_BASE_URL ?? DEFAULT_BASE).replace(/\/$/, '')
  }

  private signedHeaders(config: Record<string, string>, body: string): Record<string, string> {
    const timestamp = Math.floor(Date.now() / 1000).toString()
    const nonce = randomUUID()
    return {
      'XC-Appid': config.appid ?? '',
      'XC-Timestamp': timestamp,
      'XC-Nonce': nonce,
      'XC-Signature': hmacHex('sha256', config.hmacKey ?? '', `${nonce}${timestamp}${body}`),
      'Content-Type': 'application/json'
    }
  }

  private async fetchInvoice(config: Record<string, string>, sysNo: string): Promise<XcashInvoice> {
    // public endpoint, no signature required
    return requestJson<XcashInvoice>({
      method: 'GET',
      url: `${this.baseUrl(config)}/v1/invoice/${encodeURIComponent(sysNo)}`,
      headers: {}
    })
  }

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    const body = {
      out_no: input.orderNumber.slice(0, 32),
      title: `Order ${input.orderNumber}`.slice(0, 32),
      currency: input.currency,
      amount: formatAmount(input.amountMinor, input.currency),
      notify_url: input.webhookUrl,
      return_url: input.returnUrl
    }
    const invoice = await requestJson<XcashInvoice>({
      method: 'POST',
      url: `${this.baseUrl(input.config)}/v1/invoice`,
      headers: this.signedHeaders(input.config, JSON.stringify(body)),
      body
    })
    if (!invoice.pay_url) {
      throw new Error('Xcash invoice response missing pay_url')
    }
    return { providerOrderId: invoice.sys_no, approvalUrl: invoice.pay_url }
  }

  private mapStatus(status: string): PaymentStatusResult['status'] {
    switch (status) {
      case 'completed': return 'captured'
      case 'expired': return 'canceled'
      default: return 'created'
    }
  }

  async getPaymentStatus(input: PaymentStatusInput): Promise<PaymentStatusResult> {
    const invoice = await this.fetchInvoice(input.config, input.providerOrderId)
    return {
      providerOrderId: invoice.sys_no,
      status: this.mapStatus(invoice.status),
      providerCaptureId: invoice.payment?.hash ?? null,
      amountMinor: invoice.amount && invoice.currency
        ? parseAmountToMinor(invoice.amount, invoice.currency)
        : null,
      currency: invoice.currency ?? null
    }
  }

  async capturePayment(input: CaptureInput): Promise<CaptureResult> {
    const invoice = await this.fetchInvoice(input.config, input.providerOrderId)
    if (invoice.status !== 'completed') {
      return { providerCaptureId: '', status: 'failed', amountMinor: null, currency: null }
    }
    return {
      providerCaptureId: invoice.payment?.hash ?? invoice.sys_no,
      status: 'completed',
      amountMinor: null,
      currency: null
    }
  }

  async refundPayment(_input: RefundInput): Promise<RefundResult> {
    throw new Error('Xcash does not support API refunds; handle in the Xcash dashboard')
  }

  async verifyWebhook(headers: Record<string, string>, body: string, config: Record<string, string>): Promise<WebhookVerificationResult> {
    const header = (name: string) => headers[name] ?? headers[name.replace(/-/g, '_').toUpperCase()] ?? ''
    const signature = header('xc-signature')
    const nonce = header('xc-nonce')
    const timestamp = header('xc-timestamp')
    const expected = hmacHex('sha256', config.hmacKey ?? '', `${nonce}${timestamp}${body}`)
    if (!signature || !safeEqualHex(signature, expected)) {
      throw Object.assign(new Error('Xcash webhook signature mismatch'), { statusCode: 400 })
    }
    const parsed = JSON.parse(body) as {
      type?: string
      data?: {
        sys_no?: string
        out_no?: string
        hash?: string
        confirmed?: boolean
      }
    }
    if (parsed.type !== 'invoice') {
      // deposit events belong to wallet top-ups, not orders: no state change
      return {
        verified: true,
        eventType: 'IGNORED',
        providerEventId: nonce || `xcash-${Date.now()}`,
        providerOrderId: null,
        providerCaptureId: null,
        merchantOrderNumber: null,
        amountMinor: null,
        currency: null
      }
    }
    return {
      verified: true,
      eventType: 'PAYMENT.CAPTURE.COMPLETED',
      providerEventId: nonce || `${parsed.data?.sys_no ?? ''}:${parsed.data?.hash ?? Date.now()}`,
      providerOrderId: parsed.data?.sys_no ?? null,
      providerCaptureId: parsed.data?.hash ?? null,
      merchantOrderNumber: parsed.data?.out_no ?? null,
      amountMinor: null,
      currency: null
    }
  }

  normalizeError(error: unknown): NormalizedPaymentError {
    const message = error instanceof Error ? error.message : String(error)
    const statusCode = (error as Error & { statusCode?: number }).statusCode
    if (statusCode === 400 || statusCode === 403) {
      return { code: 'gateway_rejected', retryable: false, message }
    }
    if (statusCode === 429) {
      return { code: 'gateway_rate_limited', retryable: true, message }
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
