# P10 Commerce Foundation

## 1. 基本信息

~~~text
Phase ID: P10
Phase Name: Commerce Foundation
Owner: polibee
NuxtAdmin Base Commit: a48695f
Depends On: P00, P04
Target Version: v0.2.0-p10
Status: COMPLETE
~~~

## 2. 实现范围（对照 commerce-store-payment-design.md P10）

- **products 表**：alias UNIQUE、product_type、delivery_strategy、status、visibility、max_quantity_per_order、primary_locale_id、created_by
- **product_translations**：title、short_description、description、seo 字段；UNIQUE(product, locale)
- **product_prices**：currency + amount_minor（最小货币单位整数）；UNIQUE(product, currency)
- **inventory_batches**：批次导入记录
- **inventory_items**：secret_ciphertext + nonce + auth_tag AES-256-GCM 加密；fingerprint HMAC-SHA-256 去重
- **orders**：order_number UNIQUE、status/payment_status/fulfillment_status 三态分离
- **order_items**：product 快照（alias/title/type/price）
- **deliveries**：交付状态跟踪
- **payment_gateways**：key/provider_key/enabled/mode/config_ciphertext
- **payment_attempts**：idempotency_key UNIQUE、provider_order_id/capture_id
- **financial_transactions**：追加式流水（charge/refund/fee）
- **Encryption Service**：AES-256-GCM 加密/解密 + HMAC-SHA-256 fingerprint（server/utils/encryption.ts）
- **后台 Store 资源**：商品列表/编辑（含 LocalizedField 翻译 + 价格）
- **公开 API**：GET /api/public/store/products

### 非目标（后续 Phase）

- P11：Inventory 导入/预占/释放/交付完整流程
- P12：Order 状态机完善 + Payment Attempt 完整流程
- P13：PayPal/支付网关 Driver 实装
- P14：导出/审计/安全加固

## 3. 数据表

~~~text
products: id, alias UNIQUE, product_type, delivery_strategy, status, visibility,
          is_visible_when_oos, max_quantity_per_order, max_quantity_per_user,
          primary_locale_id FK, created_by FK, deleted_at, timestamps
product_translations: product_id FK CASCADE, locale_id FK CASCADE, title, short_description,
          description, seo_*, cover_media_id; UNIQUE(product, locale)
product_prices: product_id FK CASCADE, currency UNIQUE(+) , amount_minor, compare_amount_minor, enabled
inventory_batches: product_id FK CASCADE, batch_name, imported/valid/duplicate/invalid counts, created_by FK
inventory_items: product_id FK CASCADE, batch_id FK CASCADE, status, secret_ciphertext TEXT,
          secret_nonce, secret_auth_tag, fingerprint UNIQUE(+product), reserved_until, timestamps
orders: order_number UNIQUE, user_id FK SET NULL, email, locale_id FK, currency,
        subtotal/discount/fee/total_minor, status, payment_status, fulfillment_status, timestamps
order_items: order_id FK CASCADE, product_id FK, alias/title/type snapshot, unit/total_amount_minor,
             quantity, currency, fulfillment_status; timestamps
deliveries: order_id FK CASCADE, order_item_id FK CASCADE, status, reveal_count, timestamps
payment_gateways: key UNIQUE, provider_key, display_name, enabled, mode, config_ciphertext,
          config_nonce, config_auth_tag, key_version, enabled_currencies, sort_order
payment_attempts: order_id FK, gateway_key, idempotency_key UNIQUE, provider_order/capture_id,
          status, amount_minor, currency, approval_url, failure_*; timestamps
financial_transactions: transaction_number UNIQUE, order_id, payment_attempt_id, gateway_key,
          type(charge|refund|fee|adjustment|chargeback), status, amount_minor, currency, timestamps
~~~

## 4. 新增文件

~~~text
server/repositories/schema/products.ts     products + translations + prices + inventory
server/repositories/schema/orders.ts       orders + order_items + deliveries
server/repositories/schema/payments.ts     payment_gateways + payment_attempts + financial_transactions
server/utils/encryption.ts                 AES-256-GCM encrypt/decrypt + HMAC fingerprint + mask
server/modules/store/store.repository.ts   listPublishedProducts()
server/modules/store/store.service.ts      product CRUD + alias validation
server/api/admin/store/products/index.get.ts    列表
server/api/admin/store/products/index.post.ts   创建
server/api/public/store/products.get.ts         公开商品列表
app/modules/store/module.ts                      后台模块
app/modules/store/admin/StoreResource.ts         商品管理 UI（LocalizedField + 价格 + 上下架）
app/components/public/PostComments.vue           前台评论组件（P07）
.env: COMMERCE_ENCRYPTION_KEY + COMMERCE_FINGERPRINT_KEY（32 字节 hex）
~~~

## 5. 验证结果

~~~text
npm run lint      → PASS
npm run typecheck → PASS
npm test          → PASS（124 tests / 18 files）
npm run build     → PASS
~~~

## 6. 完成记录

~~~text
Phase Status: COMPLETE
Acceptance: PASS
Known Issues:
  - 库存导入/预占/交付完整流程属 P11
  - Order 状态机完整实现属 P12
  - Payment Gateway Driver（PayPal 等）属 P13
  - 导出/审计/安全加固属 P14
Follow-up: P11 Inventory and Delivery
~~~
