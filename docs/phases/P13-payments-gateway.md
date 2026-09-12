# P13 Unified Payment Gateway

## 1. 基本信息

~~~text
Phase ID: P13
Phase Name: Unified Payment Gateway + PayPal Driver
Owner: polibee
NuxtAdmin Base Commit: a48695f
Depends On: P10, P11, P12
Target Version: v0.2.0-p13
Status: COMPLETE（含验证缺口，见 §6）
~~~

## 2. 实现范围

- **迁移 0016**：`payment_webhook_events` 表（UNIQUE(gateway_key, provider_event_id) 幂等键、signature_verified、加密 payload 审计、processing_status 状态机 received→processed/failed/skipped）
- **Gateway Repository**：payment_gateways CRUD，config 整体 AES-256-GCM 加密落库（encryptSecret/decryptSecret），管理员回显 maskSecret 脱敏
- **Driver 接口补全（§8.2）**：createPayment / getPaymentStatus / capturePayment / refundPayment / verifyWebhook / normalizeError / supports
- **MockDriver**：开发与测试用，状态查询即报 captured，审批 URL 指向站内 /checkout/:orderNumber
- **PayPalDriver（§9）**：Checkout Orders v2（create/capture/status/refund）、OAuth2 client_credentials token 缓存、PayPal-Request-Id 幂等（= attempt idempotency key）、/v1/notifications/verify-webhook-signature 验签、金额 minor↔decimal 换算（JPY/KRW 等 0 位小数）、错误归一化（rejected/auth_failed/unavailable/timeout + retryable）
- **GatewayManager（§8.1）**：业务层唯一入口——startPayment（幂等重试、币种过滤、失败重试换新幂等键）、captureAttempt（服务端 capture + 金额/币种对账 + processPaidOrder）、syncPaymentStatus（回跳页/轮询自愈，§9.5）、handleWebhook（先验签→幂等入库→按事件分发→失败标 failed 返回 5xx 供重试）、refundOrderViaGateway（有 captured attempt 走网关退款，否则本地流水兜底）、seedDefaultGateways（seed mock 网关）
- **公开 API（§13.2）**：POST /api/public/orders/:orderNumber/payment、GET .../payment/status、GET /api/public/payments/:gateway/return（302 回 /checkout，不做支付确认）、POST /api/public/payments/:gateway/webhook（raw body 验签）、GET /api/public/payments/methods?currency=
- **后台 API（§13.3）**：GET/POST /api/admin/payment-gateways、PUT :id（掩码值不覆盖密文）、POST :id/test（PayPal 走 token 健康检查）；RBAC：store.payments.view / store.payments.edit
- **退款接通**：POST /api/admin/orders/:id/refund 改走 refundOrderViaGateway

### 非目标

- 网关后台管理 UI（资源页）与 i18n —— 后续阶段
- 公开商店/结账前端页面 —— 后续阶段（/checkout 仅作为 Mock approvalUrl 与 return 重定向目标占位）
- 真实 PayPal 沙箱联调（需沙箱凭证）

## 3. 新增文件

~~~text
server/repositories/migrations/0016_payment_webhook_events.sql (+meta 快照/日志)
server/repositories/gateway.repository.ts        payment_gateways 加密 CRUD
server/modules/payments/drivers/paypal.driver.ts  PayPal Orders v2 + 验签
server/modules/payments/gateway-manager.ts        §8.1 唯一业务入口 + seed
server/api/public/payments/methods.get.ts
server/api/public/payments/[gateway]/return.get.ts
server/api/public/payments/[gateway]/webhook.post.ts
server/api/public/orders/[orderNumber]/payment.post.ts
server/api/public/orders/[orderNumber]/payment/status.get.ts
server/api/admin/payment-gateways/index.get.ts / index.post.ts
server/api/admin/payment-gateways/[id].put.ts / [id]/test.post.ts
tests/unit/payments-driver.test.ts（14 用例）
tests/unit/payments-gateway-manager.test.ts（10 用例）
~~~

## 4. 验证结果

~~~text
npm run lint      → PASS（0 error）
npm run typecheck → PASS（顺带修复 P10~P12 存量类型错误，见 §5）
npm test          → PASS（148 tests / 20 files，含 P13 新增 24）
npm run build     → PASS
运行时 E2E        → 未执行：本机 MySQL/Docker Desktop 均无法启动（缺口见 §6）
~~~

## 5. 存量修复（非 P13 引入，闸门必需）

- order.service/store.service/store.repository：缺失 import（isNull/desc/sql/localeRows/generateOrderNumber/updateOrderStatus/releaseReserved）、幽灵字段（visibility/translations）
- payment.repository：相对导入深度错误 + financial_transactions 插入缺 occurredAt 非空字段
- admin/orders/[id].get.ts、public/posts/[alias]/comments.post.ts、public/store/products.get.ts：相对导入深度错误
- inventory.repository：无索引访问 undefined 守卫
- StoreResource：endpoints.list 类型不存在 → name 改为 'store/products'（对齐框架 `/api/admin/{name}` 约定）；产品更新/删除端点仍缺（P10 遗留）

## 6. 验证缺口

迁移 0016 未在真实 MySQL 上执行（本机 MySQL 未安装、Docker Desktop 引擎无法启动）。SQL 为纯 DDL（CREATE TABLE + UNIQUE/普通索引），与 0014/0015 同模式；unit 测试覆盖 manager/driver 逻辑但未覆盖 SQL。恢复 MySQL 环境后建议：启动 dev server 触发迁移，再以 mock 网关走 create order → payment → webhook → status 全链路。

## 7. 完成记录

~~~text
Phase Status: COMPLETE
Acceptance: PASS（四道闸门全绿）
Known Issues: ①迁移 0016 待真实 MySQL 执行验证 ②商品更新/删除端点缺失（P10 遗留）③网关管理 UI/公开商店 UI 属后续阶段
Follow-up: P14 Export and Hardening；或先补商城前端
~~~
