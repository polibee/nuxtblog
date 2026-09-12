# P13b Payment Channels and Gateway Manager UI

## 1. 基本信息

~~~text
Phase ID: P13b
Phase Name: 多渠道网关驱动 + 支付网关可视化管理
Owner: polibee
NuxtAdmin Base Commit: a48695f
Depends On: P13
Target Version: v0.2.0-p13b
Status: COMPLETE（运行时验证缺口同 P13，见 §6）
~~~

## 2. 实现范围

### 新增渠道驱动（7 个渠道可用）

- **Xcash**（docs/xcash.md）：HMAC-SHA256 签名创建 invoice（nonce+timestamp+body）、公开状态查询 /v1/invoice/{sys_no}、webhook XC-* 头验签（deposit 事件忽略）、"ok" 应答语义
- **Creem**（MoR）：/v1/checkouts 托管收银台（metadata.order_number 回传订单号）、checkout 状态轮询、creem-signature HMAC-SHA256 验签；退款由 Creem 后台处理，refund.succeeded → 本地退款
- **Lemon Squeezy**（MoR）：JSON:API checkout + custom_price（minor 直传）、checkout 轮询、X-Signature 验签、meta.custom_data 提取商户单号、total 即 minor units
- **NOWPayments**：/v1/invoice（法币计价 + IPN 回调）、x-nowpayments-sig HMAC-SHA512 验签（官方 sorted-keys 变体 + 递归排序变体双兼容）、payment_status 映射；无 JWT 状态 API → webhook 权威模式
- **Waffo**：官方 @waffo/waffo-node SDK（npm 3.1.0）封装——order.create/inquiry/refund + webhook RSA 验签；merchantId 必填、失败态 ORDER_CLOSE 按 SDK 3.1.0 实际类型适配
- **DepiPay 延后**：文档不完整（无 /invoice 响应与事件 schema）且需 secp256k1 会话密钥 EIP-191 签名（需引入椭圆曲线签名依赖），待补全文档后单独接入

### 驱动框架扩展

- CreatePaymentInput + webhookUrl / customerEmail
- WebhookVerificationResult + merchantOrderNumber（商户单号兜底定位 attempt）/ amountMinor / currency（金额对账）
- capability `capture_api`：有服务端 capture/状态 API 的渠道（PayPal/Mock/Xcash/Creem/LS/Waffo）走 captureAttempt 权威确认；无 API 的渠道（NOWPayments）验签即确认（直推 capture）
- refundOrderViaGateway：无 refund 能力渠道（Creem/LS/NOWPayments/Xcash）自动落本地退款流水

### 网关可视化管理（后台）

- provider-registry：7 渠道模板（字段/必填/密钥标记/能力/健康检查），UI 与服务端校验共用
- API：GET /api/admin/payment-gateways/providers、DELETE :id、create/PUT 按 provider 模板校验必填项（启用前强制）、test 按渠道探测（PayPal token/Creem 404 鉴权/LS /user/NP /status/Waffo merchantConfig/Mock 常通）
- 页面：app/modules/payments/admin/GatewaysManagerPage.vue —— 渠道卡片列表、启用开关（开关即时生效）、沙箱/生产徽标、排序与币种范围、按模板渲染配置表单（密钥脱敏/掩码不变更语义）、测试连接内联结果、新增/编辑/删除
- i18n：res.paygw.* 中英双语；payments 模块注册进 admin plugin（商城分组）

## 3. 新增文件

~~~text
server/modules/payments/provider-registry.ts              渠道模板 + 校验 + 健康检查
server/modules/payments/drivers/shared.ts                 金额换算 + JSON fetch + HMAC 工具
server/modules/payments/drivers/{xcash,creem,lemonsqueezy,nowpayments,waffo}.driver.ts
server/api/admin/payment-gateways/providers.get.ts / [id].delete.ts
app/modules/payments/module.ts + admin/PaymentGatewaysResource.ts + admin/GatewaysManagerPage.vue
tests/unit/payment-channels.test.ts（15 用例）
~~~

## 4. 验证结果

~~~text
npm run lint      → PASS
npm run typecheck → PASS
npm test          → PASS（167 tests / 21 files，P13b 新增 19）
npm run build     → PASS
~~~

## 5. 已知问题 / 决策记录

- manager 曾有 `driverSupportsCaptureApi` 未 await 的真 bug（Promise 恒真 → 全部走 captureAttempt），由 P13b 新增的 NOWPayments webhook 直推用例暴露并修复
- NOWPayments IPN 验签：官方 openapi 示例为 `JSON.stringify(params, Object.keys(params).sort())`，社区普遍使用递归排序——两变体均接受（都依赖 IPN Secret，安全等价）
- Nuxt typed-routes 对三段式动态 URL（/api/admin/payment-gateways/:id/test）触发 TS 深度爆栈（Excessive stack depth），页面内用 rawFetch（$fetch 结构化 cast）绕过
- Waffo SDK 3.1.0 与其文档有出入：merchantId 必填、失败态为 ORDER_CLOSE、refundAmount 必填——按实际类型适配
- syncPaymentStatus 曾返回捕获前的旧订单状态（checkout 轮询会慢一拍），已修复为捕获后重读订单

## 6. 验证缺口 → 2026-09-10 已补（Laragon MySQL 8.0.30）

- **迁移 0016 在真实 MySQL 执行**：`payment_webhook_events` 表创建成功，mock 网关 seed 正常
- **mock 网关全链路 E2E**（订单 ORD-MTUV6LUX6ILK / ORD-MTUVABDV24BB）：create order（库存预占）→ POST payment（attempt created + approvalUrl）→ webhook（attempt captured）→ status 轮询（order paid / payment captured）→ charge 流水 ×2、库存 reserved ×2、webhook 事件 processed
- **webhook 失败路径**：无法匹配 attempt 的 payload → 5xx + 事件表记录 failed（供 provider 重试）
- **后台渠道管理 API**：providers 列表（7 渠道）、缺必填配置创建返回 400、完整创建、测试连接、掩码回显均符合预期
- **路由守卫**：/admin/payment-gateways 未登录时正确重定向登录页
- **剩余缺口**：网关管理页的可视化人工验证（browser-use 视口未开 + 分类器拦截自动化登录），可在浏览器登录后访问 /admin/payment-gateways 自查

## 7. 完成记录

~~~text
Phase Status: COMPLETE
Acceptance: PASS（四道闸门全绿）
Known Issues: ①DepiPay 待文档补全后接入 ②运行时 E2E 缺口同 P13 ③Creem/LS/NP 渠道退款 API 未实现（webhook 兜底 + 本地流水）
Follow-up: P14 Export and Hardening；公开商店/结账前端
~~~
