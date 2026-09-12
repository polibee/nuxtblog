# P12 Orders and Transactions

## 1. 基本信息

~~~text
Phase ID: P12
Phase Name: Orders and Transactions
Owner: polibee
NuxtAdmin Base Commit: a48695f
Depends On: P10, P11
Target Version: v0.2.0-p12
Status: COMPLETE
~~~

## 2. 实现范围

- **Payment Attempt 管理**：payment.repository.ts——创建（idempotency_key UNIQUE）、状态更新、按 orderId 查询
- **Financial Transaction 记录**：charge（支付时）+ refund（退款时）追加式流水
- **订单生命周期完善**：processPaidOrder（markPaid + recordCharge）、processFulfillment（deliverReserved + markFulfilled）、cancelOrderById（releaseReserved + markCanceled）、refundOrder（markRefunded + recordRefund）
- **后台订单 API**：GET /api/admin/orders（分页列表）、GET :id（详情）、POST :id/cancel（取消+释放库存）、POST :id/refund（退款+流水）
- **订单状态机**：pending_payment → paid → fulfilled；pending_payment → canceled；paid → refunded

### 非目标

- PaymentGatewayManager 和真实 Driver（PayPal/Stripe）属 P13
- Webhook 验签属 P13
- 导出属 P14

## 3. 新增文件

~~~text
server/repositories/payment.repository.ts        Payment Attempt + Financial Transaction
server/modules/store/order-lifecycle.service.ts  processPaidOrder/processFulfillment/cancelOrderById/refundOrder
server/api/admin/orders/index.get.ts             订单列表
server/api/admin/orders/[id].get.ts              订单详情
server/api/admin/orders/[id]/cancel.post.ts      取消订单
server/api/admin/orders/[id]/refund.post.ts      退款订单
~~~

## 4. 验证结果

~~~text
npm run lint      → PASS
npm run typecheck → PASS
npm test          → PASS（124 tests / 18 files）
npm run build     → PASS
~~~

## 5. 完成记录

~~~text
Phase Status: COMPLETE
Acceptance: PASS
Known Issues: Payment Gateway Driver 为框架预留，真实 PayPal/Stripe 适配属 P13
Follow-up: P13 Unified Payment Gateway（Driver 实装 + Webhook 验签）
~~~
