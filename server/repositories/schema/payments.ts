import {
  bigint,
  boolean,
  datetime,
  index,
  int,
  mysqlTable,
  text,
  uniqueIndex,
  varchar
} from 'drizzle-orm/mysql-core'

/* Payment gateways, attempts, financial transactions.
   Gateway config encrypted AES-256-GCM at rest. */

export const paymentGateways = mysqlTable(
  'payment_gateways',
  {
    id: bigint('id', { mode: 'number' }).notNull().autoincrement().primaryKey(),
    key: varchar('key', { length: 40 }).notNull(),
    providerKey: varchar('provider_key', { length: 40 }).notNull(),
    displayName: varchar('display_name', { length: 80 }).notNull(),
    enabled: boolean('enabled').notNull().default(false),
    mode: varchar('mode', { length: 20 }).notNull().default('sandbox'),
    sortOrder: int('sort_order').notNull().default(0),
    configCiphertext: text('config_ciphertext'),
    configNonce: varchar('config_nonce', { length: 64 }),
    configAuthTag: varchar('config_auth_tag', { length: 64 }),
    keyVersion: int('key_version').notNull().default(1),
    enabledCurrencies: varchar('enabled_currencies', { length: 200 }),
    createdAt: datetime('created_at', { fsp: 6, mode: 'date' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: datetime('updated_at', { fsp: 6, mode: 'date' })
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdateFn(() => new Date())
  },
  table => [
    uniqueIndex('payment_gateways_key_key').on(table.key),
    index('payment_gateways_enabled_idx').on(table.enabled)
  ]
)

export const paymentAttempts = mysqlTable(
  'payment_attempts',
  {
    id: bigint('id', { mode: 'number' }).notNull().autoincrement().primaryKey(),
    orderId: bigint('order_id', { mode: 'number' }).notNull(),
    gatewayKey: varchar('gateway_key', { length: 40 }).notNull(),
    idempotencyKey: varchar('idempotency_key', { length: 120 }).notNull(),
    providerOrderId: varchar('provider_order_id', { length: 255 }),
    providerPaymentId: varchar('provider_payment_id', { length: 255 }),
    providerCaptureId: varchar('provider_capture_id', { length: 255 }),
    status: varchar('status', { length: 30 }).notNull().default('created'),
    amountMinor: bigint('amount_minor', { mode: 'number' }).notNull(),
    currency: varchar('currency', { length: 3 }).notNull(),
    approvalUrl: varchar('approval_url', { length: 2048 }),
    failureCode: varchar('failure_code', { length: 60 }),
    failureMessage: varchar('failure_message', { length: 500 }),
    createdAt: datetime('created_at', { fsp: 6, mode: 'date' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: datetime('updated_at', { fsp: 6, mode: 'date' })
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdateFn(() => new Date())
  },
  table => [
    uniqueIndex('payment_attempts_idempotency_key').on(table.idempotencyKey),
    index('payment_attempts_order_idx').on(table.orderId),
    index('payment_attempts_status_idx').on(table.status)
  ]
)

/* Webhook audit trail (commerce doc §8.5): verify-then-process,
   provider_event_id unique per gateway for idempotency. */
export const paymentWebhookEvents = mysqlTable(
  'payment_webhook_events',
  {
    id: bigint('id', { mode: 'number' }).notNull().autoincrement().primaryKey(),
    gatewayKey: varchar('gateway_key', { length: 40 }).notNull(),
    providerEventId: varchar('provider_event_id', { length: 255 }).notNull(),
    eventType: varchar('event_type', { length: 120 }).notNull(),
    signatureVerified: boolean('signature_verified').notNull().default(false),
    payloadCiphertext: text('payload_ciphertext'),
    receivedAt: datetime('received_at', { fsp: 6, mode: 'date' }).notNull(),
    processedAt: datetime('processed_at', { fsp: 6, mode: 'date' }),
    processingStatus: varchar('processing_status', { length: 30 }).notNull().default('received'),
    errorMessage: varchar('error_message', { length: 500 }),
    createdAt: datetime('created_at', { fsp: 6, mode: 'date' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: datetime('updated_at', { fsp: 6, mode: 'date' })
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdateFn(() => new Date())
  },
  table => [
    uniqueIndex('payment_webhook_events_gateway_event_key').on(table.gatewayKey, table.providerEventId),
    index('payment_webhook_events_status_idx').on(table.processingStatus)
  ]
)

export const financialTransactions = mysqlTable(
  'financial_transactions',
  {
    id: bigint('id', { mode: 'number' }).notNull().autoincrement().primaryKey(),
    transactionNumber: varchar('transaction_number', { length: 30 }).notNull(),
    orderId: bigint('order_id', { mode: 'number' }),
    paymentAttemptId: bigint('payment_attempt_id', { mode: 'number' }),
    gatewayKey: varchar('gateway_key', { length: 40 }),
    type: varchar('type', { length: 20 }).notNull(),
    status: varchar('status', { length: 20 }).notNull(),
    amountMinor: bigint('amount_minor', { mode: 'number' }).notNull(),
    currency: varchar('currency', { length: 3 }).notNull(),
    providerTransactionId: varchar('provider_transaction_id', { length: 255 }),
    providerEventId: varchar('provider_event_id', { length: 255 }),
    occurredAt: datetime('occurred_at', { fsp: 6, mode: 'date' }).notNull(),
    description: varchar('description', { length: 500 }),
    createdBy: bigint('created_by', { mode: 'number' }),
    createdAt: datetime('created_at', { fsp: 6, mode: 'date' })
      .notNull()
      .$defaultFn(() => new Date())
  },
  table => [
    uniqueIndex('financial_transactions_number_key').on(table.transactionNumber),
    index('financial_transactions_order_idx').on(table.orderId),
    index('financial_transactions_type_idx').on(table.type)
  ]
)
