/* Payment Gateway Driver interface (commerce doc §8.2).
   All gateway drivers implement this interface. Business code only
   interacts via PaymentGatewayManager, never with vendor SDKs directly. */

export type GatewayMode = 'sandbox' | 'live'

export interface CreatePaymentInput {
  orderNumber: string
  amountMinor: number
  currency: string
  /** customer email when the order has one; providers that require it use this */
  customerEmail: string | null
  returnUrl: string
  cancelUrl: string
  webhookUrl: string
  idempotencyKey: string
  config: Record<string, string>
  mode: GatewayMode
}

export interface CreatePaymentResult {
  providerOrderId: string
  approvalUrl: string
}

export type PaymentState = 'created' | 'approved' | 'captured' | 'pending' | 'failed' | 'canceled'

export interface PaymentStatusInput {
  providerOrderId: string
  config: Record<string, string>
  mode: GatewayMode
}

export interface PaymentStatusResult {
  providerOrderId: string
  status: PaymentState
  providerCaptureId: string | null
  amountMinor: number | null
  currency: string | null
}

export interface CaptureInput {
  providerOrderId: string
  idempotencyKey: string
  config: Record<string, string>
  mode: GatewayMode
}

export interface CaptureResult {
  providerCaptureId: string
  status: 'completed' | 'pending' | 'failed'
  amountMinor: number | null
  currency: string | null
}

export interface RefundInput {
  providerCaptureId: string
  amountMinor: number | null
  currency: string
  idempotencyKey: string
  config: Record<string, string>
  mode: GatewayMode
}

export interface RefundResult {
  providerRefundId: string
  status: 'completed' | 'pending' | 'failed'
}

export interface WebhookVerificationResult {
  verified: boolean
  eventType: string
  providerEventId: string
  providerOrderId: string | null
  providerCaptureId: string | null
  /** merchant order number echoed by the provider (used to locate the attempt) */
  merchantOrderNumber: string | null
  /** order snapshot amounts when the provider echoes them, for §9.1 #9 checks */
  amountMinor: number | null
  currency: string | null
}

export interface NormalizedPaymentError {
  code: string
  retryable: boolean
  message: string
}

export interface PaymentGatewayDriver {
  providerKey: string
  createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult>
  getPaymentStatus(input: PaymentStatusInput): Promise<PaymentStatusResult>
  capturePayment(input: CaptureInput): Promise<CaptureResult>
  refundPayment(input: RefundInput): Promise<RefundResult>
  verifyWebhook(headers: Record<string, string>, body: string, config: Record<string, string>): Promise<WebhookVerificationResult>
  normalizeError(error: unknown): NormalizedPaymentError
  /* capabilities: create, capture, capture_api (server-side capture/status API,
     false = webhook-authoritative), refund, webhook, redirect, sandbox */
  supports(capability: string): boolean
}
