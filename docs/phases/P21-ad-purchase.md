# P21 广告购买（Campaign Purchase）

## 1. 基本信息

~~~text
Phase ID: P21
Phase Name: 广告计划购买 + 订单流水关联 + 网关数据
Owner: polibee
NuxtAdmin Base Commit: a48695f
Depends On: P13（订单/支付网关链路）、P15（影子商品模式）、P17（广告模块）
Target Version: v0.2.0-p21
Status: COMPLETE
~~~

## 2. 实现范围（摘要）

- **数据层（0025）**：ad_campaigns += budget_minor / currency / paid_amount_minor / order_id / paid_at
- **影子商品扩展**：SHADOW_TYPES 增加 'ad_campaign'（alias `ad-{id}`，数量限 1）；order.service SHADOW_PRODUCT_TYPES 同步——跳过库存预占
- **支付完成钩子**：fulfillShadowOrderItems 处理 ad_campaign——计划自动置 active、写入 paid_amount/order_id/paid_at
- **购买服务**：purchaseCampaign（更新预算→影子商品→createOrder）+ campaignPayments（订单 + 支付尝试 + 交易流水按广告计划聚合）
- **Admin API**：POST /api/admin/advertising/campaigns/:id/purchase（buyer=当前管理员）；GET .../payments
- **管理页**：广告计划 pages.list → CampaignsManagerPage——预算/已付/关联订单列、购买对话框（预算+币种→创建订单→跳转 /checkout）、订单流水抽屉（网关尝试 + charge/refund 交易）；Resource 表单补预算/币种字段

## 3. 验证结果

~~~text
npm run lint      → PASS（0 errors；既有 v-html 警告 1 条可接受）
npm run typecheck → PASS
npm test          → PASS（167 tests / 21 files）
npm run build     → PASS
真实 MySQL E2E    → PASS
~~~

## 4. 真实环境 E2E

- 建计划 #2 → purchase → 订单 ORD-MTWZE468MV01（$50.00）→ mock 网关 capture → 计划自动 active + paid 5000 + orderId 14 + paidAt
- payments API：order fulfilled + attempt mock/captured + transaction charge/completed/mock/5000
- 排障：createOrder 最初对 ad_campaign 触发库存预占 409——SHADOW_PRODUCT_TYPES 补齐后解决

## 5. 完成记录

~~~text
Phase Status: COMPLETE
Acceptance: PASS（四道闸门 + 真实环境端到端）
Known Issues: 购买人当前为执行操作的管理员（无独立广告主账户体系）；退款后计划不自动下线（需人工）
Follow-up: 广告主账户/自助投放、曝光/点击计费模式、退款联动计划状态
~~~
