# P13c Storefront

## 1. 基本信息

~~~text
Phase ID: P13c
Phase Name: 公开商店前端（列表/详情/结账/支付状态）
Owner: polibee
NuxtAdmin Base Commit: a48695f
Depends On: P13, P13b
Target Version: v0.2.0-p13c
Status: COMPLETE
~~~

## 2. 实现范围

- **自动交付**（设计文档 §2.1）：processPaidOrder 在支付捕获后自动触发 processFulfillment——v1 全部为虚拟商品（§2.2 无实物），支付即交付
- **公开订单/交付 API**：GET /api/public/orders/:orderNumber——订单摘要 + items + 已交付卡密（按订单号作为能力凭证，仅 paymentStatus=captured 后解密返回，rate limit 120/min）
- **公开单商品 API**：GET /api/public/store/products/:alias（补齐设计文档 §13.2 清单）
- **公开商店页**（/store）：locale-aware 商品卡片（标题/简介/首档价格/库存徽章），空态
- **商品详情页**（/store/[alias]）：描述、多币种价格选择、数量选择（≤ min(maxQuantityPerOrder, 库存)）、合计、购买 → 创建订单跳结账页；422 限购等错误内联展示
- **结账/支付状态页**（/checkout/[orderNumber]）：订单摘要 + 状态徽章；待支付时列出可用渠道（GET /api/public/payments/methods?currency=，单渠道自动选中）并发起支付——外部 approvalUrl 跳转渠道收银台（回跳 return 端点 302 回本页），mock/站内 URL 由 3s 轮询自愈；已支付展示卡密交付区；过期/取消视图
- **i18n**：public.store.* / public.checkout.* 中英双语；StoreProduct 类型迁移至 shared/types/store.ts 前后端共用

### 非目标

- 购物车/多商品合并下单（v1 单商品下单）
- 促销/优惠码；structured_reveal 的分步 reveal POST 端点（§13.2 遗留，P14 可补）

## 3. 新增文件

~~~text
shared/types/store.ts                              公开商品类型（前后端共用）
server/api/public/orders/[orderNumber]/index.get.ts  订单状态 + 交付
server/api/public/store/products/[alias].get.ts    单商品
app/pages/store/index.vue + [alias].vue            商店列表/详情
app/pages/checkout/[orderNumber].vue               结账/支付状态
app/utils/money.ts                                 minor→显示金额（0/2 位小数规则与驱动一致）
~~~

## 4. 验证结果

~~~text
npm run lint      → PASS
npm run typecheck → PASS
npm test          → PASS（167 tests / 21 files）
npm run build     → PASS
真实 MySQL E2E    → PASS（见 §5）
~~~

## 5. 真实环境 E2E（Laragon MySQL 8.0.30 + dev server）

- /store 渲染商品卡（库存随下单实时扣减 3→2→1）；/store/e2e-card 详情页价格/数量/合计正确；限购校验（maxQuantityPerOrder=1 时 quantity=2 → 422）
- 全链路（ORD-MTUWIYP770V7）：下单（预占库存）→ mock 支付 → webhook → **自动交付**（fulfilled/delivered）→ 结账页展示解密卡密（E2E-KEY-1-3）
- 待支付视图（ORD-MTUWMLW3N4L2）：渠道选择 + 去支付按钮；browser-use 结构化快照验证三个页面均正常（含 SSR 修复后）
- 修复：结账页曾在 SSR 阶段调用 setInterval（500），已移入 onMounted

## 6. 完成记录

~~~text
Phase Status: COMPLETE
Acceptance: PASS（四道闸门全绿 + 真实环境端到端）
Known Issues: structured_reveal 分步展示 POST 端点未实现；订单号即能力凭证（无登录校验），公开可查单属设计取舍
Follow-up: P14 Export and Hardening
~~~
