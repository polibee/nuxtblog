# 博客框架商城与统一支付网关设计

## 1. 文档定位

本文档为现有博客框架新增商城、虚拟商品交付、订单、交易流水、数据导出和统一支付网关的开发规格。

适用基线：

- Nuxt 4 + Nitro + Vue 3 + TypeScript
- NuxtAdmin 后台基座
- MySQL + Drizzle ORM + Repository
- Entity + Translation 多语言模型
- Entity 级英文 alias
- 服务端 RBAC、事件、缓存和审计
- 站内一方 Analytics，不依赖 Analytics 完成支付或交付

依赖文档：

- Blog-Framework-v1.0-nuxtadmin-architecture.md
- Blog-Framework-navigation-menu-design.md
- Blog-Framework-alias-unification-implementation-prompt.md

---

## 2. 第一版范围和边界

### 2.1 第一版支持

- 单站点、单商户。
- 商品上架、下架、草稿、归档。
- 商品价格、库存、销售限制。
- 虚拟商品自动交付。
- 卡密、礼品卡、账号、邀请码和其他文本/结构化商品。
- 订单管理。
- 支付尝试和交易流水。
- 退款状态记录。
- 按日期筛选和导出订单、交易、库存摘要。
- 统一支付网关。
- PayPal 支付适配。
- 其他支付方式以 Gateway Driver 扩展。
- 多个支付网关可以同时启用，也可以按需启用。
- 支付网关配置和虚拟商品库存加密存储。

### 2.2 第一版暂不实现

- 多商户或平台分账。
- 实物商品、物流和收货地址。
- 购物车长期保存和复杂促销系统。
- 订阅扣款。
- 复杂税务、发票和结算中心。
- 自动处理争议、拒付和人工客服流程。
- 原始银行卡号、CVV 或完整支付凭证存储。
- 公开售卖用户账号、违规服务或未经授权的账号资源。

第一版允许未来扩展，但数据库、订单和支付接口不能阻断后续增加这些能力。

---

## 3. 核心设计原则

### 3.1 支付成功不等于交付完成

支付状态、订单状态和交付状态分开管理：

    payment captured
        ↓
    order paid
        ↓
    inventory allocated
        ↓
    delivery fulfilled

支付成功后库存不足或交付失败时，订单进入 fulfillment_pending，不能静默标记为已交付。

### 3.2 支付确认必须服务端完成

以下内容不能作为支付成功依据：

- 前端回调参数。
- 浏览器跳转成功页面。
- 客户端传入的金额。
- 客户端传入的商品价格。
- 客户端传入的库存 ID。

必须由服务端根据订单快照和支付网关响应核对：

- 订单 ID。
- 商户账号。
- Provider Order ID。
- Provider Transaction/Capture ID。
- 金额。
- 币种。
- 支付状态。
- Webhook 签名或网关查询结果。

### 3.3 虚拟库存以库存单元为中心

不要只保存一个 stock_count。每个卡密、礼品卡、账号、邀请码都应有独立的 Inventory Item，才能保证：

- 并发购买不重复交付。
- 单个资源可以撤销。
- 订单可以追踪具体交付内容。
- 导入库存可以去重。
- 交付失败可以重试。
- 后台可以查看库存状态而不暴露密文。

### 3.4 所有支付操作幂等

创建支付、捕获支付、退款、Webhook 和交付都必须有幂等键：

    order_id + operation
    provider_event_id
    payment_attempt_id
    delivery_id

重复请求只能得到原操作结果，不能重复扣款、重复扣库存或重复交付。

---

## 4. 领域模型

### 4.1 Product

商品实体：

    products
    ├── id
    ├── alias
    ├── product_type       card_key | gift_card | account | invite_code | other
    ├── delivery_strategy  one_time_reveal | structured_reveal | link
    ├── status             draft | published | off_shelf | archived
    ├── visibility         public | members
    ├── is_visible_when_oos
    ├── max_quantity_per_order
    ├── max_quantity_per_user nullable
    ├── primary_locale_id
    ├── created_by
    ├── created_at
    ├── updated_at
    └── deleted_at

商品状态说明：

- draft：编辑中，不公开销售。
- published：公开上架。
- off_shelf：主动下架，历史订单不受影响。
- archived：归档，不允许新订单。

上架状态和库存状态分离。商品可以上架但显示售罄，也可以因为库存不足自动禁止购买。

### 4.2 Product Translation

    product_translations
    ├── id
    ├── product_id
    ├── locale_id
    ├── title
    ├── short_description
    ├── description
    ├── seo_title
    ├── seo_description
    ├── cover_media_id nullable
    ├── created_at
    └── updated_at

商品 alias 不进入 Translation。切换语言时使用同一个 alias，切换标题、描述和 SEO 内容。

### 4.3 Product Price

    product_prices
    ├── id
    ├── product_id
    ├── currency
    ├── amount_minor
    ├── compare_amount_minor nullable
    ├── enabled
    ├── created_at
    └── updated_at

金额使用最小货币单位的整数，例如分，不使用浮点数：

    USD 10.99 -> 1099
    CNY 19.90 -> 1990

订单创建后必须复制商品名称、alias、单价、币种和税费快照。商品改价不能改变历史订单。

### 4.4 Inventory Batch

批次用于导入、供应商记录和库存追踪：

    inventory_batches
    ├── id
    ├── product_id
    ├── batch_name
    ├── source
    ├── imported_count
    ├── valid_count
    ├── duplicate_count
    ├── invalid_count
    ├── created_by
    ├── created_at
    └── notes

### 4.5 Inventory Item

    inventory_items
    ├── id
    ├── product_id
    ├── batch_id
    ├── status             available | reserved | allocated | delivered | revoked | expired
    ├── secret_ciphertext
    ├── secret_nonce
    ├── secret_auth_tag
    ├── wrapped_key nullable
    ├── key_version
    ├── fingerprint
    ├── reserved_until nullable
    ├── order_id nullable
    ├── order_item_id nullable
    ├── delivery_id nullable
    ├── delivered_at nullable
    ├── revoked_at nullable
    ├── created_at
    └── updated_at

secret_ciphertext 可以是：

- 卡密字符串。
- 礼品卡号和 PIN 的 JSON。
- 账号、密码、登录地址的 JSON。
- 邀请码和说明的 JSON。
- 其他结构化虚拟商品数据。

fingerprint 只用于去重，使用独立密钥计算 HMAC-SHA-256，不能用明文直接做唯一索引。

库存状态必须通过状态机改变，不允许后台直接任意修改字符串。

### 4.6 Order

    orders
    ├── id
    ├── order_number
    ├── user_id nullable
    ├── email
    ├── locale_id
    ├── currency
    ├── subtotal_minor
    ├── discount_minor
    ├── fee_minor
    ├── total_minor
    ├── status
    ├── payment_status
    ├── fulfillment_status
    ├── expires_at
    ├── paid_at nullable
    ├── fulfilled_at nullable
    ├── canceled_at nullable
    ├── created_at
    └── updated_at

推荐订单状态：

    pending_payment
    payment_processing
    paid
    fulfillment_pending
    fulfilled
    partially_fulfilled
    canceled
    expired
    refund_pending
    refunded
    failed

推荐支付状态：

    unpaid
    pending
    approved
    captured
    failed
    canceled
    partially_refunded
    refunded
    reversed

推荐交付状态：

    pending
    reserved
    allocated
    delivered
    partially_delivered
    failed
    revoked

### 4.7 Order Item

    order_items
    ├── id
    ├── order_id
    ├── product_id
    ├── product_alias_snapshot
    ├── product_title_snapshot
    ├── product_type_snapshot
    ├── unit_amount_minor
    ├── quantity
    ├── total_amount_minor
    ├── currency
    ├── fulfillment_status
    ├── created_at
    └── updated_at

订单项必须保留快照，不能依赖当前商品标题、价格或上架状态。

### 4.8 Delivery

    deliveries
    ├── id
    ├── order_id
    ├── order_item_id
    ├── delivery_strategy
    ├── status             pending | delivered | failed | revoked
    ├── reveal_count
    ├── first_revealed_at nullable
    ├── last_revealed_at nullable
    ├── delivered_at nullable
    ├── revoked_at nullable
    ├── created_at
    └── updated_at

Inventory Item 和 Delivery 必须一对一或由明确的交付明细关系绑定，不能重复领取同一库存单元。

---

## 5. 库存管理

### 5.1 库存导入

后台支持：

- 单条新增。
- 文本批量粘贴。
- CSV 导入。
- 按批次导入。
- 导入预览。
- 重复值检测。
- 格式错误检测。
- 导入结果下载。

导入流程：

1. 上传文件或提交文本。
2. 服务端解析，不立即写入可售库存。
3. 展示总数、有效数、重复数、错误数。
4. 管理员确认。
5. 事务写入 Batch 和 Inventory Items。
6. 生成审计记录。

导入报告不能返回完整密文。错误行只能显示行号和脱敏原因。

### 5.2 预占库存

创建订单时：

1. 服务端重新读取商品价格和销售状态。
2. 检查商品是否 published。
3. 检查数量限制。
4. 在事务中锁定可用库存。
5. 将库存改为 reserved。
6. 写入 reserved_until，例如 10 分钟后。
7. 创建订单和订单项。
8. 创建支付尝试。

支付失败、订单取消或超时后释放预占库存。

### 5.3 交付分配

支付确认后：

1. 将订单改为 paid。
2. 将 reserved Inventory Items 改为 allocated。
3. 创建 Delivery。
4. 解密并生成交付 DTO。
5. 将库存改为 delivered。
6. 写入 delivered_at。
7. 将订单改为 fulfilled。

任何步骤失败必须支持安全重试，不得重新分配已经 delivered 的库存。

### 5.4 库存显示

管理员可以看到：

- 总库存数量。
- 可用数量。
- 预占数量。
- 已分配数量。
- 已交付数量。
- 撤销数量。
- 过期数量。
- 最近导入批次。
- 最近交付记录。

管理员默认不能在库存列表直接看到完整密文。查看或重新展示交付内容需要独立权限和审计记录。

---

## 6. 虚拟商品交付

### 6.1 交付方式

#### one_time_reveal

适用于卡密、邀请码和礼品卡：

- 只允许授权订单用户查看。
- 默认只显示一次完整内容。
- 后续访问显示已交付状态，是否允许重新查看由商品策略决定。
- 可以提供复制按钮，但不能写入普通日志。

#### structured_reveal

适用于账号：

    {
      username,
      password,
      login_url,
      note
    }

账号商品必须显示安全提示：

- 不要重复使用密码。
- 不要在公共设备保存。
- 购买者自行承担账号可用性和供应商规则风险。
- 如需售后，后台通过订单和库存单元处理。

#### link

适用于一次性领取链接：

- 链接本身必须加密保存。
- 领取后标记为 delivered。
- 不把访问令牌放在普通 URL 查询参数中。
- 访问链接需要短期签名或一次性授权。

### 6.2 交付接口

建议：

    GET  /api/public/orders/:orderNumber
    GET  /api/public/orders/:orderNumber/delivery
    POST /api/public/orders/:orderNumber/delivery/reveal

接口要求：

- 用户登录订单所属账号，或通过邮箱验证码/一次性订单访问令牌验证。
- 服务端校验订单状态。
- 只返回当前用户有权查看的交付内容。
- 返回内容不写入 Analytics。
- 重复调用必须幂等。
- 每次 reveal 写入 Delivery Audit。

不要通过邮件、URL、前端状态或浏览器 localStorage 保存完整卡密和密码。

### 6.3 退款和已交付商品

虚拟商品交付后默认不能自动恢复库存。退款策略：

- 未交付：可以自动释放库存并退款。
- 已交付但未查看：由业务策略决定是否允许撤销。
- 已查看：默认进入人工审核。
- 账号类商品：退款必须撤销交付资格，不能自动假设账号已恢复可售。
- 退款和撤销都需要订单、支付和交付状态同步。

---

## 7. 订单流程

### 7.1 创建订单

    POST /api/public/orders

服务端只接受：

- product_id
- quantity
- currency
- requested_locale
- idempotency_key

服务端自行读取：

- 商品状态。
- 商品 alias。
- 商品标题。
- 当前价格。
- 库存。
- 用户限制。
- 订单金额。

创建订单时不接受客户端传入的最终金额。

### 7.2 支付流程

    创建订单
      ↓
    事务预占库存
      ↓
    创建 Payment Attempt
      ↓
    统一 PaymentGatewayManager 创建支付
      ↓
    返回 approval_url 或客户端所需 token
      ↓
    用户完成支付授权
      ↓
    服务端 capture 或等待 Webhook
      ↓
    校验金额、币种、订单和商户账号
      ↓
    payment.captured
      ↓
    自动交付
      ↓
    订单完成

浏览器回跳页面只用于展示状态和继续查询，不能直接把订单标记为 paid。

### 7.3 超时和取消

订单超过 expires_at：

- 未支付：订单变为 expired。
- 释放 reserved 库存。
- 关闭未完成的 Payment Attempt。
- 保留操作流水。
- 不删除订单。

已经 captured 的订单不能通过普通取消接口撤销，必须走退款流程。

---

## 8. 统一支付网关

### 8.1 Gateway Manager

业务层只能调用：

    PaymentGatewayManager.createPayment()
    PaymentGatewayManager.getPaymentStatus()
    PaymentGatewayManager.capturePayment()
    PaymentGatewayManager.refundPayment()
    PaymentGatewayManager.verifyWebhook()
    PaymentGatewayManager.normalizeError()

业务层不能直接调用 PayPal、Stripe 或其他供应商 SDK。

### 8.2 Driver 接口

    interface PaymentGatewayDriver {
      key: string
      providerKey: string
      createPayment(input): Promise<CreatePaymentResult>
      getPaymentStatus(input): Promise<PaymentStatusResult>
      capturePayment(input): Promise<CaptureResult>
      refundPayment(input): Promise<RefundResult>
      verifyWebhook(input): Promise<WebhookVerificationResult>
      normalizeError(error): NormalizedPaymentError
      supports(capability): boolean
    }

推荐 capability：

    create
    capture
    refund
    webhook
    redirect
    multi_currency
    sandbox

### 8.3 支付网关配置

    payment_gateways
    ├── id
    ├── key
    ├── provider_key
    ├── display_name
    ├── enabled
    ├── mode                 sandbox | live
    ├── sort_order
    ├── config_ciphertext
    ├── config_nonce
    ├── config_auth_tag
    ├── key_version
    ├── enabled_currencies
    ├── created_at
    └── updated_at

    payment_methods
    ├── id
    ├── gateway_id
    ├── method_key
    ├── display_name
    ├── enabled
    ├── sort_order
    ├── supported_currencies
    └── created_at

用户结算页只展示同时满足以下条件的方法：

- Gateway enabled。
- Payment Method enabled。
- 当前运行环境允许。
- 当前币种支持。
- 当前订单商品和金额规则允许。
- 配置完整且健康检查通过。

多个网关可以同时启用。管理员可以通过 enabled、sort_order 和币种范围按需启用。

### 8.4 Payment Attempt

    payment_attempts
    ├── id
    ├── order_id
    ├── gateway_id
    ├── method_id
    ├── idempotency_key
    ├── provider_order_id nullable
    ├── provider_payment_id nullable
    ├── provider_capture_id nullable
    ├── status
    ├── amount_minor
    ├── currency
    ├── approval_url nullable
    ├── failure_code nullable
    ├── failure_message nullable
    ├── last_checked_at nullable
    ├── created_at
    └── updated_at

唯一约束建议：

    UNIQUE(idempotency_key)
    UNIQUE(gateway_id, provider_order_id)
    UNIQUE(gateway_id, provider_capture_id)

### 8.5 Webhook Event

    payment_webhook_events
    ├── id
    ├── gateway_id
    ├── provider_event_id
    ├── event_type
    ├── signature_verified
    ├── payload_ciphertext nullable
    ├── received_at
    ├── processed_at nullable
    ├── processing_status
    └── error_message nullable

Webhook 必须先验签，再进入事件处理。相同 provider_event_id 重复发送时只能处理一次。

---

## 9. PayPal 适配设计

### 9.1 第一版流程

PayPal Driver 使用 PayPal Checkout Orders v2：

1. 服务端创建 PayPal Order。
2. 使用订单快照金额和币种。
3. 使用 intent=CAPTURE。
4. 将 PayPal Order ID 写入 Payment Attempt。
5. 返回用户审批 URL 或前端所需信息。
6. 用户批准后，服务端调用 capture。
7. 保存 PayPal Capture ID。
8. 同时接收并验签 PayPal Webhook。
9. 只有金额、币种、商户账号、订单关联和状态全部通过才确认支付。
10. 触发订单交付。

PayPal 文档说明：Checkout 的资金移动应由后端调用 Capture Payment for Order API 完成；Orders API 的 capture 端点为 POST /v2/checkout/orders/{id}/capture。

### 9.2 PayPal 必须处理的事件

至少支持：

    CHECKOUT.ORDER.APPROVED
    CHECKOUT.PAYMENT-APPROVAL.REVERSED
    PAYMENT.CAPTURE.COMPLETED
    PAYMENT.CAPTURE.PENDING
    PAYMENT.CAPTURE.DENIED
    PAYMENT.CAPTURE.REFUNDED
    PAYMENT.CAPTURE.REVERSED

Webhook 事件必须：

- 验证来源和签名。
- 保存 provider_event_id。
- 保存原始报文的加密版本或经过脱敏的审计版本。
- 幂等处理。
- 将 provider 状态映射到内部 Payment/Order 状态。
- 不以 Webhook 单独覆盖金额和订单绑定校验。
- 失败后可重试。

### 9.3 PayPal 幂等

对支持的 POST 请求使用 PayPal-Request-Id，并使用本地 Payment Attempt 的稳定幂等键生成请求 ID。

捕获、退款和重试不能生成新的业务操作 ID。PayPal 官方文档说明 PayPal-Request-Id 用于 REST POST 请求幂等，实际支持情况仍需按具体 API 参考确认。

### 9.4 PayPal 配置

至少包含：

    PAYPAL_CLIENT_ID
    PAYPAL_CLIENT_SECRET
    PAYPAL_WEBHOOK_ID
    PAYPAL_ENVIRONMENT
    PAYPAL_BASE_URL

生产环境凭证优先使用环境变量、Secret Manager 或 KMS。若配置写入数据库，必须通过统一加密服务加密，后台不回显完整 secret。

不要存储原始银行卡数据。优先使用 PayPal 托管的审批和支付流程，以控制 PCI 范围。

### 9.5 PayPal 回跳和 Webhook 的边界

- return_url 只负责回到站内订单状态页。
- cancel_url 只负责回到取消提示页。
- 回跳结果不能单独确认支付。
- capture 结果或经过验证的 Webhook 才能推进 payment.captured。
- 即使用户关闭回跳页面，服务端仍应通过 Webhook 或主动查询完成订单处理。

PayPal 官方参考：

- https://developer.paypal.com/platforms/checkout/standard/integrate/
- https://developer.paypal.com/api/rest/integration/orders-api/
- https://developer.paypal.com/api/rest/webhooks/event-names/
- https://developer.paypal.com/api/rest/webhooks/rest/
- https://developer.paypal.com/reference/guidelines/idempotency/

---

## 10. 交易流水和对账

### 10.1 Financial Transaction

交易流水使用追加式记录，不允许覆盖历史金额：

    financial_transactions
    ├── id
    ├── transaction_number
    ├── order_id nullable
    ├── payment_attempt_id nullable
    ├── gateway_id nullable
    ├── type                 charge | refund | fee | adjustment | chargeback
    ├── status               pending | completed | failed | reversed
    ├── amount_minor
    ├── currency
    ├── provider_transaction_id nullable
    ├── provider_event_id nullable
    ├── occurred_at
    ├── description
    ├── metadata_ciphertext nullable
    ├── created_by nullable
    └── created_at

一笔退款不能修改原 charge，而是新增一条 refund 流水并关联原交易。

### 10.2 交易流水页面

后台提供：

- 交易编号。
- 订单编号。
- 类型。
- 网关和支付方式。
- Provider Transaction ID。
- 金额和币种。
- 状态。
- 创建时间和发生时间。
- 退款关联。
- 失败原因。
- 导出按钮。

权限：

    commerce.transactions.view
    commerce.transactions.export
    commerce.refunds.manage

### 10.3 对账规则

每日或手动对账时比较：

- 本地订单金额。
- Payment Attempt 金额。
- Provider Capture 金额。
- 本地 charge 流水。
- Provider Webhook 状态。
- 本地退款和 Provider refund 状态。

发现不一致时标记 reconciliation_pending，不直接自动修改金额。

---

## 11. 数据导出

### 11.1 导出范围

第一版支持：

- 订单。
- 订单项。
- 支付尝试。
- 交易流水。
- 商品库存摘要。
- 交付摘要。

默认不导出：

- 完整卡密。
- 完整礼品卡 PIN。
- 完整账号密码。
- Payment Gateway Secret。
- 未脱敏的 Webhook 凭证。

如确需导出敏感交付内容，必须使用独立权限、二次确认、审计和加密下载文件。

### 11.2 日期筛选

后台导出页面提供：

- 开始日期。
- 结束日期。
- 日期字段：created_at、paid_at、delivered_at、occurred_at。
- 时区：站点时区展示，数据库统一保存 UTC。
- 产品筛选。
- 网关筛选。
- 支付状态筛选。
- 订单状态筛选。
- CSV 格式。

日期查询使用左闭右开：

    from <= timestamp < to

避免结束日期 23:59:59 的精度问题。

### 11.3 Export Job

    export_jobs
    ├── id
    ├── requested_by
    ├── export_type
    ├── filters_json
    ├── status          queued | processing | completed | failed | expired
    ├── file_path
    ├── file_hash
    ├── expires_at
    ├── created_at
    └── completed_at nullable

导出超过一定数据量时使用异步任务：

1. 创建 Export Job。
2. 后台任务执行查询。
3. 生成 CSV。
4. 文件加密或放入受控私有存储。
5. 生成短期下载链接。
6. 下载行为写入审计。
7. 过期后自动清理。

---

## 12. 加密和安全边界

### 12.1 统一加密服务

建议提供：

    EncryptionService.encryptSecret()
    EncryptionService.decryptSecret()
    EncryptionService.fingerprint()
    EncryptionService.mask()

适用范围：

- Inventory Item secret。
- Payment Gateway config。
- Webhook 原始敏感报文。
- 交易 metadata 中的敏感字段。

推荐使用 AES-256-GCM 或平台 KMS/Secret Manager 的信封加密能力，保存 nonce、auth tag 和 key_version。

### 12.2 必须禁止

- 明文库存写入日志。
- 明文库存写入 Analytics。
- 明文支付密钥写入数据库或 Git。
- 将完整账号密码写入异常消息。
- 通过 query string 传递完整卡密。
- 用前端金额作为最终结算金额。
- 仅根据前端回跳结果发货。
- 让管理员列表默认显示完整敏感库存。
- 通过普通邮件发送账号密码。

### 12.3 审计

以下操作必须审计：

- 商品上架、下架、价格修改。
- 库存导入、撤销、删除。
- 查看或重新展示交付内容。
- 订单人工改状态。
- 退款。
- Gateway 启用、禁用、配置修改。
- 导出创建和下载。
- Webhook 重放和人工重试。

---

## 13. NuxtAdmin 模块和 API

### 13.1 推荐模块

    app/modules/store/
    app/modules/inventory/
    app/modules/orders/
    app/modules/transactions/
    app/modules/payments/

服务端：

    server/modules/store/
    server/modules/inventory/
    server/modules/orders/
    server/modules/transactions/
    server/modules/payments/

### 13.2 前台 API

    GET  /api/public/store/products
    GET  /api/public/store/products/:alias
    POST /api/public/orders
    GET  /api/public/orders/:orderNumber
    GET  /api/public/orders/:orderNumber/delivery
    POST /api/public/orders/:orderNumber/delivery/reveal
    POST /api/public/orders/:orderNumber/payment
    GET  /api/public/orders/:orderNumber/payment/status
    GET  /api/public/payments/:gateway/return
    POST /api/public/payments/:gateway/webhook

### 13.3 后台 API

    GET    /api/admin/store/products
    POST   /api/admin/store/products
    PUT    /api/admin/store/products/:id
    POST   /api/admin/store/products/:id/publish
    POST   /api/admin/store/products/:id/off-shelf

    GET    /api/admin/inventory
    POST   /api/admin/inventory/import
    POST   /api/admin/inventory/import/preview
    POST   /api/admin/inventory/:id/revoke
    GET    /api/admin/inventory/summary

    GET    /api/admin/orders
    GET    /api/admin/orders/:id
    POST   /api/admin/orders/:id/cancel
    POST   /api/admin/orders/:id/refund
    POST   /api/admin/orders/:id/retry-delivery

    GET    /api/admin/transactions
    GET    /api/admin/payment-gateways
    PUT    /api/admin/payment-gateways/:id
    POST   /api/admin/payment-gateways/:id/test

    POST   /api/admin/exports
    GET    /api/admin/exports
    GET    /api/admin/exports/:id/download

所有后台 API 必须服务端执行 RBAC，前端隐藏按钮不能作为权限控制。

---

## 14. RBAC 权限

建议权限：

    commerce.products.view
    commerce.products.create
    commerce.products.edit
    commerce.products.publish
    commerce.inventory.view
    commerce.inventory.import
    commerce.inventory.adjust
    commerce.inventory.reveal
    commerce.orders.view
    commerce.orders.manage
    commerce.orders.refund
    commerce.deliveries.view
    commerce.deliveries.retry
    commerce.transactions.view
    commerce.transactions.export
    commerce.payment_gateways.view
    commerce.payment_gateways.manage
    commerce.payment_gateways.test
    commerce.exports.create
    commerce.exports.download

敏感权限建议单独拆分：

- inventory.reveal：查看完整库存内容。
- deliveries.reveal：重新查看交付内容。
- payment_gateways.manage：修改支付密钥或配置。
- transactions.export：导出财务数据。

---

## 15. 前台页面

建议页面：

    app/pages/store/index.vue
    app/pages/store/[alias].vue
    app/pages/checkout/[orderNumber].vue
    app/pages/orders/[orderNumber].vue
    app/pages/orders/[orderNumber]/delivery.vue

商品 URL 使用 Entity alias，并复用现有 Alias-aware route resolver：

    /store/{alias}
    /zh/store/{alias}
    /en/store/{alias}

如果未来需要商品进入 Header/Footer 菜单，可以新增 Product 菜单项类型；第一版可以先通过 Custom Link 或专用商品入口访问。

---

## 16. 推荐实施 Phase

在现有商业化路线中建议拆分为：

### P10 Commerce Foundation

- Product、Translation、Price。
- Product Alias。
- 上架/下架。
- Product 页面。
- 基础 RBAC。
- 数据库 Migration。

### P11 Inventory and Delivery

- Inventory Batch。
- Inventory Item。
- 加密存储。
- 导入、去重、预占、释放。
- Delivery。
- 卡密、礼品卡、账号、邀请码交付。

### P12 Orders and Transactions

- Order、Order Item。
- Order 状态机。
- Payment Attempt。
- Financial Transaction。
- 退款记录。
- 对账基础。
- 订单和交易后台页面。

### P13 Unified Payment Gateway

- PaymentGatewayManager。
- Driver 接口。
- PayPal Driver。
- Webhook 验签和幂等。
- 多支付方式启用。
- Sandbox/Live 配置。
- 支付测试和失败重试。

### P14 Export and Hardening

- 日期筛选导出。
- 审计。
- 敏感数据脱敏。
- 限流。
- 对账报告。
- 回滚和故障恢复。
- 安全测试。

---

## 17. 交给其他 AI 的开发指令

    你正在一个 Nuxt 4 + Nitro + Vue 3 + TypeScript + NuxtAdmin + MySQL 的博客框架中开发一个简单商城。

    商城第一版只做单站点、单商户、纯虚拟商品：
    卡密、礼品卡、账号、邀请码和其他结构化虚拟商品。
    不实现实物物流、多商户分账和订阅扣款。

    请先阅读：
    1. Blog-Framework-v1.0-nuxtadmin-architecture.md
    2. Blog-Framework-navigation-menu-design.md
    3. Blog-Framework-alias-unification-implementation-prompt.md
    4. 本文 Blog-Framework-commerce-store-payment-design.md
    5. NuxtAdmin 当前 Resource、Module、RBAC、事件、缓存和公开 API 实现

    必须实现：
    1. Product、Product Translation、Product Price。
    2. Product 上架、下架、草稿和归档。
    3. Product 使用 Entity 级英文 alias。
    4. Inventory Batch 和 Inventory Item。
    5. 卡密、礼品卡、账号、邀请码和其他虚拟商品库存。
    6. 库存导入、预览、去重、预占、释放、分配和撤销。
    7. Inventory secret 使用统一加密服务，禁止明文日志。
    8. Order、Order Item、Delivery。
    9. 支付前事务预占库存，支付成功后幂等交付。
    10. Payment Attempt 和 Financial Transaction。
    11. 日期选择、CSV 导出、异步 Export Job 和下载审计。
    12. PaymentGatewayManager 和 PaymentGatewayDriver。
    13. PayPal Orders v2、服务端 capture、Webhook 验签和幂等。
    14. 其他支付方式通过 Driver 扩展，不把供应商逻辑写入订单服务。
    15. 多个 Gateway 和 Payment Method 可同时启用或按需启用。
    16. 退款、撤销、失败重试和订单状态机。
    17. 后台 RBAC、审计日志和敏感字段脱敏。
    18. Unit、Integration、SSR、Webhook、Build 和 Playwright E2E 测试。

    必须遵守：
    1. 不信任前端金额、价格、库存或支付成功参数。
    2. 不以浏览器回跳作为支付成功依据。
    3. 不存储原始银行卡号、CVV 或完整支付凭证。
    4. 不把 PayPal SDK 直接散落在订单服务中。
    5. 不明文存储卡密、礼品卡 PIN、账号密码或支付密钥。
    6. 不重复交付 Inventory Item。
    7. 不重复处理 Webhook、capture、refund 和 delivery。
    8. 不允许商品改价影响历史订单。
    9. 不允许商品下架影响历史订单交付。
    10. Analytics 不能成为支付、订单或交付的硬依赖。
    11. 不修改 NuxtAdmin Core，优先通过业务模块扩展。
    12. 不覆盖现有用户未提交的代码和数据。

    开发顺序：
    1. 先检查仓库现状，列出受影响文件。
    2. 设计并实现数据库 Migration。
    3. 实现 Product 和 Inventory Service。
    4. 实现 Order、Reservation 和 Delivery Service。
    5. 实现 PaymentGatewayManager 和 PayPal Driver。
    6. 实现后台页面、RBAC 和导出。
    7. 完成测试和安全检查。
    8. 输出变更文件、测试结果、已知问题、迁移风险和回滚方案。

---

## 18. 验收清单

### 商品

- [ ] 商品可以创建、编辑、上架、下架和归档。
- [ ] 商品有英文 alias。
- [ ] 商品标题和描述支持 Translation。
- [ ] 商品价格使用整数最小货币单位。
- [ ] 改价不改变历史订单。
- [ ] 下架不影响历史订单交付。

### 库存和交付

- [ ] 支持卡密、礼品卡、账号、邀请码和其他类型。
- [ ] 支持批量导入和去重。
- [ ] 库存以独立 Inventory Item 管理。
- [ ] 支付前可以预占库存。
- [ ] 超时和失败可以释放库存。
- [ ] 支付成功后只交付一次。
- [ ] 明文库存不进入日志、Analytics 和普通导出。
- [ ] 已交付库存可以审计和撤销。

### 订单和支付

- [ ] 订单金额由服务端计算。
- [ ] Payment Attempt 可追踪 Provider Order/Capture ID。
- [ ] Gateway Manager 统一处理支付。
- [ ] 多网关和多支付方式可以同时启用。
- [ ] PayPal 使用服务端 capture。
- [ ] PayPal Webhook 验签并幂等。
- [ ] 支付状态、订单状态和交付状态分离。
- [ ] 退款新增流水，不覆盖原 charge。
- [ ] 重试不会重复扣款或交付。

### 交易和导出

- [ ] 交易流水追加写入。
- [ ] 支持 charge、refund、fee、adjustment、chargeback。
- [ ] 支持日期选择和时区转换。
- [ ] 日期查询使用左闭右开。
- [ ] CSV 导出异步执行。
- [ ] 导出链接短期有效。
- [ ] 导出创建和下载有审计。
- [ ] 敏感数据默认脱敏。

### 安全

- [ ] Gateway Secret 加密或使用 Secret Manager。
- [ ] Inventory Secret 使用 AES-GCM/KMS 等安全方案。
- [ ] Webhook 原始报文可验证、可审计。
- [ ] RBAC 在服务端执行。
- [ ] 敏感交付内容需要独立权限。
- [ ] 没有将原始银行卡数据放入系统。
- [ ] Payment、Delivery、Webhook、Refund 都有幂等保护。

完成标准：商品、库存、订单、交付、支付、交易流水、导出和 PayPal 适配都可以在统一的服务边界内运行，且支付成功不会导致重复扣款、重复库存分配或重复交付。
