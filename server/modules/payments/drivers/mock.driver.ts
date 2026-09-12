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

/** Mock driver for dev/testing — approval URL points back at the site
    checkout page; status reports captured so the return flow completes. */
export class MockDriver implements PaymentGatewayDriver {
  providerKey = 'mock'

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    return {
      providerOrderId: `MOCK-${input.idempotencyKey}`,
      approvalUrl: `/checkout/${input.orderNumber}?mock=true&attempt=${encodeURIComponent(input.idempotencyKey)}`
    }
  }

  async getPaymentStatus(input: PaymentStatusInput): Promise<PaymentStatusResult> {
    return {
      providerOrderId: input.providerOrderId,
      status: 'captured',
      providerCaptureId: `MOCK-CAPTURE-${Date.now()}`,
      amountMinor: null,
      currency: null
    }
  }

  async capturePayment(input: CaptureInput): Promise<CaptureResult> {
    return {
      providerCaptureId: `MOCK-CAPTURE-${input.idempotencyKey}`,
      status: 'completed',
      amountMinor: null,
      currency: null
    }
  }

  async refundPayment(input: RefundInput): Promise<RefundResult> {
    return {
      providerRefundId: `MOCK-REFUND-${input.idempotencyKey}`,
      status: 'completed'
    }
  }

  async verifyWebhook(_headers: Record<string, string>, body: string, _config: Record<string, string>): Promise<WebhookVerificationResult> {
    const parsed = JSON.parse(body) as { eventType?: string, eventId?: string, orderId?: string }
    return {
      verified: true,
      eventType: parsed.eventType ?? 'unknown',
      providerEventId: parsed.eventId ?? `mock-${Date.now()}`,
      providerOrderId: parsed.orderId ?? null,
      providerCaptureId: null,
      merchantOrderNumber: null,
      amountMinor: null,
      currency: null
    }
  }

  normalizeError(error: unknown): NormalizedPaymentError {
    return {
      code: 'mock_error',
      retryable: true,
      message: error instanceof Error ? error.message : String(error)
    }
  }

  supports(capability: string): boolean {
    return ['create', 'capture', 'capture_api', 'refund', 'webhook', 'sandbox'].includes(capability)
  }
}
