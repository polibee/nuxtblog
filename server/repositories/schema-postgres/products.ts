import {
  text,
  bigint,
  boolean,
  timestamp,
  foreignKey,
  index,
  integer,
  pgTable,
  uniqueIndex,
  varchar
} from 'drizzle-orm/pg-core'
import { locales } from './locales'
import { users } from './users'

/* Commerce schema (commerce-store-payment-design.md §4).
   All money values use minor units (integer cents). All entities use
   locale-independent alias. Inventory secrets are AES-256-GCM encrypted. */

export const products = pgTable(
  'products',
  {
    id: bigint('id', { mode: 'number' }).notNull().generatedByDefaultAsIdentity().primaryKey(),
    alias: varchar('alias', { length: 120 }).notNull(),
    // card_key | gift_card | account | invite_code | other
    productType: varchar('product_type', { length: 30 }).notNull().default('card_key'),
    // one_time_reveal | structured_reveal | link
    deliveryStrategy: varchar('delivery_strategy', { length: 30 }).notNull().default('one_time_reveal'),
    // draft | published | off_shelf | archived
    status: varchar('status', { length: 20 }).notNull().default('draft'),
    // public | members
    visibility: varchar('visibility', { length: 20 }).notNull().default('public'),
    isVisibleWhenOos: boolean('is_visible_when_oos').notNull().default(true),
    maxQuantityPerOrder: integer('max_quantity_per_order').notNull().default(1),
    maxQuantityPerUser: integer('max_quantity_per_user'),
    /* optional product image → media.id; a missing media row means "no image" */
    imageMediaId: bigint('image_media_id', { mode: 'number' }),
    primaryLocaleId: bigint('primary_locale_id', { mode: 'number' }).notNull(),
    createdBy: bigint('created_by', { mode: 'number' }).notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'date' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdateFn(() => new Date())
  },
  table => [
    uniqueIndex('products_alias_key').on(table.alias),
    index('products_status_idx').on(table.status),
    index('products_type_idx').on(table.productType),
    foreignKey({ name: 'products_primary_locale_id_fk', columns: [table.primaryLocaleId], foreignColumns: [locales.id] }),
    foreignKey({ name: 'products_created_by_fk', columns: [table.createdBy], foreignColumns: [users.id] })
  ]
)

export const productTranslations = pgTable(
  'product_translations',
  {
    id: bigint('id', { mode: 'number' }).notNull().generatedByDefaultAsIdentity().primaryKey(),
    productId: bigint('product_id', { mode: 'number' }).notNull(),
    localeId: bigint('locale_id', { mode: 'number' }).notNull(),
    title: varchar('title', { length: 255 }).notNull(),
    shortDescription: varchar('short_description', { length: 500 }),
    description: text('description'),
    seoTitle: varchar('seo_title', { length: 255 }),
    seoDescription: varchar('seo_description', { length: 500 }),
    coverMediaId: bigint('cover_media_id', { mode: 'number' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdateFn(() => new Date())
  },
  table => [
    uniqueIndex('product_translations_product_locale_key').on(table.productId, table.localeId),
    index('product_translations_locale_idx').on(table.localeId),
    foreignKey({ name: 'product_translations_product_id_fk', columns: [table.productId], foreignColumns: [products.id] }).onDelete('cascade'),
    foreignKey({ name: 'product_translations_locale_id_fk', columns: [table.localeId], foreignColumns: [locales.id] }).onDelete('cascade')
  ]
)

export const productPrices = pgTable(
  'product_prices',
  {
    id: bigint('id', { mode: 'number' }).notNull().generatedByDefaultAsIdentity().primaryKey(),
    productId: bigint('product_id', { mode: 'number' }).notNull(),
    currency: varchar('currency', { length: 3 }).notNull(),
    amountMinor: bigint('amount_minor', { mode: 'number' }).notNull(),
    compareAmountMinor: bigint('compare_amount_minor', { mode: 'number' }),
    enabled: boolean('enabled').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdateFn(() => new Date())
  },
  table => [
    uniqueIndex('product_prices_product_currency_key').on(table.productId, table.currency),
    foreignKey({ name: 'product_prices_product_id_fk', columns: [table.productId], foreignColumns: [products.id] }).onDelete('cascade')
  ]
)

export const inventoryBatches = pgTable('inventory_batches', {
  id: bigint('id', { mode: 'number' }).notNull().generatedByDefaultAsIdentity().primaryKey(),
  productId: bigint('product_id', { mode: 'number' }).notNull(),
  batchName: varchar('batch_name', { length: 120 }).notNull(),
  source: varchar('source', { length: 120 }),
  importedCount: integer('imported_count').notNull().default(0),
  validCount: integer('valid_count').notNull().default(0),
  duplicateCount: integer('duplicate_count').notNull().default(0),
  invalidCount: integer('invalid_count').notNull().default(0),
  createdBy: bigint('created_by', { mode: 'number' }).notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
    .notNull()
    .$defaultFn(() => new Date())
}, table => [
  index('inventory_batches_product_idx').on(table.productId),
  foreignKey({ name: 'inventory_batches_product_id_fk', columns: [table.productId], foreignColumns: [products.id] }).onDelete('cascade'),
  foreignKey({ name: 'inventory_batches_created_by_fk', columns: [table.createdBy], foreignColumns: [users.id] })
])

export const inventoryItems = pgTable(
  'inventory_items',
  {
    id: bigint('id', { mode: 'number' }).notNull().generatedByDefaultAsIdentity().primaryKey(),
    productId: bigint('product_id', { mode: 'number' }).notNull(),
    batchId: bigint('batch_id', { mode: 'number' }).notNull(),
    // available | reserved | allocated | delivered | revoked | expired
    status: varchar('status', { length: 20 }).notNull().default('available'),
    secretCiphertext: text('secret_ciphertext').notNull(),
    secretNonce: varchar('secret_nonce', { length: 64 }).notNull(),
    secretAuthTag: varchar('secret_auth_tag', { length: 64 }).notNull(),
    fingerprint: varchar('fingerprint', { length: 64 }).notNull(),
    reservedUntil: timestamp('reserved_until', { withTimezone: true, mode: 'date' }),
    orderId: bigint('order_id', { mode: 'number' }),
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
    uniqueIndex('inventory_items_fingerprint_key').on(table.productId, table.fingerprint),
    index('inventory_items_product_status_idx').on(table.productId, table.status),
    index('inventory_items_batch_idx').on(table.batchId),
    foreignKey({ name: 'inventory_items_product_id_fk', columns: [table.productId], foreignColumns: [products.id] }).onDelete('cascade'),
    foreignKey({ name: 'inventory_items_batch_id_fk', columns: [table.batchId], foreignColumns: [inventoryBatches.id] }).onDelete('cascade')
  ]
)
