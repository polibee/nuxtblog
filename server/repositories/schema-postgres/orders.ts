import {
  bigint,
  timestamp,
  foreignKey,
  index,
  integer,
  pgTable,
  uniqueIndex,
  varchar
} from 'drizzle-orm/pg-core'
import { locales } from './locales'
import { products } from './products'
import { users } from './users'

/* Orders + Deliveries + Payment Attempts + Financial Transactions
   (commerce-store-payment-design.md §4.6-§4.8, §8.4, §10.1).
   Payment captured ≠ delivery fulfilled: separate status columns. */

export const orders = pgTable(
  'orders',
  {
    id: bigint('id', { mode: 'number' }).notNull().generatedByDefaultAsIdentity().primaryKey(),
    orderNumber: varchar('order_number', { length: 30 }).notNull(),
    userId: bigint('user_id', { mode: 'number' }),
    email: varchar('email', { length: 255 }).notNull(),
    localeId: bigint('locale_id', { mode: 'number' }).notNull(),
    currency: varchar('currency', { length: 3 }).notNull().default('USD'),
    subtotalMinor: bigint('subtotal_minor', { mode: 'number' }).notNull().default(0),
    discountMinor: bigint('discount_minor', { mode: 'number' }).notNull().default(0),
    feeMinor: bigint('fee_minor', { mode: 'number' }).notNull().default(0),
    totalMinor: bigint('total_minor', { mode: 'number' }).notNull().default(0),
    // pending_payment | paid | fulfilled | canceled | expired | failed | refunded
    status: varchar('status', { length: 30 }).notNull().default('pending_payment'),
    // unpaid | pending | captured | failed | refunded
    paymentStatus: varchar('payment_status', { length: 30 }).notNull().default('unpaid'),
    // pending | delivered | failed
    fulfillmentStatus: varchar('fulfillment_status', { length: 30 }).notNull().default('pending'),
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }),
    paidAt: timestamp('paid_at', { withTimezone: true, mode: 'date' }),
    fulfilledAt: timestamp('fulfilled_at', { withTimezone: true, mode: 'date' }),
    canceledAt: timestamp('canceled_at', { withTimezone: true, mode: 'date' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdateFn(() => new Date())
  },
  table => [
    uniqueIndex('orders_order_number_key').on(table.orderNumber),
    index('orders_user_idx').on(table.userId),
    index('orders_status_idx').on(table.status),
    index('orders_email_idx').on(table.email),
    foreignKey({ name: 'orders_user_id_fk', columns: [table.userId], foreignColumns: [users.id] }).onDelete('set null'),
    foreignKey({ name: 'orders_locale_id_fk', columns: [table.localeId], foreignColumns: [locales.id] })
  ]
)

export const orderItems = pgTable(
  'order_items',
  {
    id: bigint('id', { mode: 'number' }).notNull().generatedByDefaultAsIdentity().primaryKey(),
    orderId: bigint('order_id', { mode: 'number' }).notNull(),
    productId: bigint('product_id', { mode: 'number' }).notNull(),
    productAliasSnapshot: varchar('product_alias_snapshot', { length: 120 }).notNull(),
    productTitleSnapshot: varchar('product_title_snapshot', { length: 255 }).notNull(),
    productTypeSnapshot: varchar('product_type_snapshot', { length: 30 }).notNull(),
    unitAmountMinor: bigint('unit_amount_minor', { mode: 'number' }).notNull(),
    quantity: integer('quantity').notNull().default(1),
    totalAmountMinor: bigint('total_amount_minor', { mode: 'number' }).notNull(),
    currency: varchar('currency', { length: 3 }).notNull(),
    // pending | delivered | failed
    fulfillmentStatus: varchar('fulfillment_status', { length: 30 }).notNull().default('pending'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdateFn(() => new Date())
  },
  table => [
    index('order_items_order_idx').on(table.orderId),
    foreignKey({ name: 'order_items_order_id_fk', columns: [table.orderId], foreignColumns: [orders.id] }).onDelete('cascade'),
    foreignKey({ name: 'order_items_product_id_fk', columns: [table.productId], foreignColumns: [products.id] })
  ]
)

export const deliveries = pgTable(
  'deliveries',
  {
    id: bigint('id', { mode: 'number' }).notNull().generatedByDefaultAsIdentity().primaryKey(),
    orderId: bigint('order_id', { mode: 'number' }).notNull(),
    orderItemId: bigint('order_item_id', { mode: 'number' }).notNull(),
    // pending | delivered | failed | revoked
    status: varchar('status', { length: 20 }).notNull().default('pending'),
    revealCount: integer('reveal_count').notNull().default(0),
    firstRevealedAt: timestamp('first_revealed_at', { withTimezone: true, mode: 'date' }),
    lastRevealedAt: timestamp('last_revealed_at', { withTimezone: true, mode: 'date' }),
    deliveredAt: timestamp('delivered_at', { withTimezone: true, mode: 'date' }),
    revokedAt: timestamp('revoked_at', { withTimezone: true, mode: 'date' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdateFn(() => new Date())
  },
  table => [
    index('deliveries_order_idx').on(table.orderId),
    foreignKey({ name: 'deliveries_order_id_fk', columns: [table.orderId], foreignColumns: [orders.id] }).onDelete('cascade'),
    foreignKey({ name: 'deliveries_order_item_id_fk', columns: [table.orderItemId], foreignColumns: [orderItems.id] }).onDelete('cascade')
  ]
)
