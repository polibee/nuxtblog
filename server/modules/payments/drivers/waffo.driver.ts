import { Waffo, Environment } from '@waffo/waffo-node'
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
import { formatAmount, parseAmountToMinor } from './shared'

/* Waffo Payment Platform via the official @waffo/waffo-node SDK
   (docs/waffo.md). Config: apiKey, privateKey (base64 PKCS8),
   waffoPublicKey, merchantId. Hosted checkout + RSA-signed webhooks
   (x-signature header). */

interface WaffoWebhookNotification {
  eventType?: string
  result?: {
    acquiringOrderId?: string
    merchantOrderId?: string
    orderStatus?: string
    orderAmount?: string
    orderCurrency?: string
  }
}

function waffoRequestId(idempotencyKey: string): string {
  return idempotencyKey.replace(/[^a-zA-Z0-9]/g, '').slice(0, 32)
}

export class WaffoDriver implements PaymentGatewayDriver {
  providerKey = 'waffo'

  private client(config: Record<string, string>, mode: string): InstanceType<typeof Waffo> {
    return new Waffo({
      apiKey: config.apiKey ?? '',
      privateKey: config.privateKey ?? '',
      waffoPublicKey: config.waffoPublicKey ?? '',
      merchantId: config.merchantId ?? '',
      environment: mode === 'live' ? Environment.PRODUCTION : Environment.SANDBOX
    })
  }

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    const client = this.client(input.config, input.mode)
    const response = await client.order().create({
      paymentRequestId: waffoRequestId(input.idempotencyKey),
      merchantOrderId: input.orderNumber,
      orderCurrency: input.currency,
      orderAmount: formatAmount(input.amountMinor, input.currency),
      orderDescription: `Order ${input.orderNumber}`,
      notifyUrl: input.webhookUrl,
      successRedirectUrl: input.returnUrl,
      failedRedirectUrl: input.cancelUrl,
      cancelRedirectUrl: input.cancelUrl,
      userInfo: {
        userId: input.orderNumber,
        userEmail: input.customerEmail ?? 'guest@waffo.local',
        userTerminal: 'WEB'
      },
      paymentInfo: { productName: 'ONE_TIME_PAYMENT' }
    })
    if (!response.isSuccess()) {
      throw Object.assign(new Error(`Waffo order create failed: ${response.getMessage()}`), { statusCode: 400 })
    }
    const data = response.getDataOrThrow()
    if (!data.orderAction) {
      throw Object.assign(new Error('Waffo order create response missing checkout URL'), { statusCode: 502 })
    }
    return { providerOrderId: data.acquiringOrderId ?? data.paymentRequestId ?? input.orderNumber, approvalUrl: data.orderAction }
  }

  async getPaymentStatus(input: PaymentStatusInput): Promise<PaymentStatusResult> {
    const client = this.client(input.config, input.mode)
    const response = await client.order().inquiry({ acquiringOrderId: input.providerOrderId })
    if (!response.isSuccess()) {
      throw Object.assign(new Error(`Waffo inquiry failed: ${response.getMessage()}`), { statusCode: 400 })
    }
    const data = response.getDataOrThrow()
    return {
      providerOrderId: data.acquiringOrderId ?? input.providerOrderId,
      status: data.orderStatus === 'PAY_SUCCESS' ? 'captured' : data.orderStatus === 'ORDER_CLOSE' ? 'failed' : 'created',
      providerCaptureId: data.acquiringOrderId ?? null,
      amountMinor: data.orderAmount && data.orderCurrency ? parseAmountToMinor(data.orderAmount, data.orderCurrency) : null,
      currency: data.orderCurrency ?? null
    }
  }

  async capturePayment(input: CaptureInput): Promise<CaptureResult> {
    const client = this.client(input.config, input.mode)
    const response = await client.order().inquiry({ acquiringOrderId: input.providerOrderId })
    if (!response.isSuccess()) {
      return { providerCaptureId: '', status: 'failed', amountMinor: null, currency: null }
    }
    const data = response.getDataOrThrow()
    if (data.orderStatus !== 'PAY_SUCCESS') {
      return { providerCaptureId: '', status: 'failed', amountMinor: null, currency: null }
    }
    return {
      providerCaptureId: data.acquiringOrderId ?? input.providerOrderId,
      status: 'completed',
      amountMinor: data.orderAmount && data.orderCurrency ? parseAmountToMinor(data.orderAmount, data.orderCurrency) : null,
      currency: data.orderCurrency ?? null
    }
  }

  async refundPayment(input: RefundInput): Promise<RefundResult> {
    const client = this.client(input.config, input.mode)
    const response = await client.order().refund({
      refundRequestId: waffoRequestId(input.idempotencyKey),
      acquiringOrderId: input.providerCaptureId,
      refundAmount: formatAmount(input.amountMinor ?? 0, input.currency),
      refundReason: 'Merchant refund'
    })
    if (!response.isSuccess()) {
      throw Object.assign(new Error(`Waffo refund failed: ${response.getMessage()}`), { statusCode: 400 })
    }
    return { providerRefundId: response.getDataOrThrow().acquiringRefundOrderId ?? waffoRequestId(input.idempotencyKey)!, status: 'completed' }
  }

  async verifyWebhook(headers: Record<string, string>, body: string, config: Record<string, string>): Promise<WebhookVerificationResult> {
    const signature = headers['x-signature'] ?? headers['X-Signature'] ?? ''
    if (!signature || !config.waffoPublicKey) {
      throw Object.assign(new Error('Waffo webhook signature or public key missing'), { statusCode: 400 })
    }
    let notification: WaffoWebhookNotification | null = null
    const client = this.client(config, 'sandbox')
    const handler = client.webhook()
      .onPayment((n) => { notification = n as WaffoWebhookNotification })
      .onRefund((n) => { notification = n as WaffoWebhookNotification })
      .onSubscriptionStatus((n) => { notification = n as WaffoWebhookNotification })
      .onSubscriptionPeriodChanged((n) => { notification = n as WaffoWebhookNotification })
      .onSubscriptionChange((n) => { notification = n as WaffoWebhookNotification })
    await handler.handleWebhook(body, signature)
    if (!notification) {
      throw Object.assign(new Error('Waffo webhook type not handled'), { statusCode: 400 })
    }

    const event = notification as WaffoWebhookNotification
    const eventType = event.eventType ?? 'UNKNOWN'
    let internalEvent = 'IGNORED'
    if (eventType === 'PAYMENT_NOTIFICATION') {
      if (event.result?.orderStatus === 'PAY_SUCCESS') internalEvent = 'PAYMENT.CAPTURE.COMPLETED'
      else if (event.result?.orderStatus === 'PAY_FAIL') internalEvent = 'PAYMENT.CAPTURE.DENIED'
    } else if (eventType === 'REFUND_NOTIFICATION') {
      internalEvent = 'PAYMENT.CAPTURE.REFUNDED'
    }
    return {
      verified: true,
      eventType: internalEvent,
      providerEventId: `${eventType}:${event.result?.acquiringOrderId ?? Date.now()}`,
      providerOrderId: event.result?.acquiringOrderId ?? null,
      providerCaptureId: event.result?.acquiringOrderId ?? null,
      merchantOrderNumber: event.result?.merchantOrderId ?? null,
      amountMinor: event.result?.orderAmount && event.result?.orderCurrency
        ? parseAmountToMinor(event.result.orderAmount, event.result.orderCurrency)
        : null,
      currency: event.result?.orderCurrency ?? null
    }
  }

  normalizeError(error: unknown): NormalizedPaymentError {
    const message = error instanceof Error ? error.message : String(error)
    const statusCode = (error as Error & { statusCode?: number }).statusCode
    if (statusCode === 400 || statusCode === 401) {
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
    return ['create', 'capture', 'capture_api', 'refund', 'webhook', 'redirect', 'sandbox'].includes(capability)
  }
}
