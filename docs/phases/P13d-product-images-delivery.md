# P13d Product Images and Structured Delivery

## 1. 基本信息

~~~text
Phase ID: P13d
Phase Name: 商品图片 + 商品管理修复 + structured_reveal 分步交付
Owner: polibee
NuxtAdmin Base Commit: a48695f
Depends On: P13c
Target Version: v0.2.0-p13d
Status: COMPLETE
~~~

## 2. 实现范围

- **修复后台商品管理 404**（用户报告）：admin 资源路由只取路径第一段，`store/products` 被解析成不存在的 "store"。`app/pages/admin/[...path].vue` 改为最长前缀匹配（segments 逐级 join('/') 查注册表），id/action 取余下段
- **商品图片（可选）**：迁移 0017 `products.image_media_id`（普通列，媒体删除自然降级为无图）；输入 schema `imageMediaId`；公开 API 组装 `image {url:/media/:key, w, h}`；StoreResource 表单 relationInput(media) + 表格 imageColumn；前端 `PublicProductImage` 组件——有图显示、无图内置 SVG 占位（默认商品图）
- **商品管理端点补齐（P10 遗留）**：GET /api/admin/store/products/:id（详情含 translations/prices/imageMediaId）、PUT :id（标量字段 + translations/prices 整体替换）；admin 列表改回标准 `Paginated` 分页（旧版裸数组导致后台表格永远"加载中 0 条"——第二个用户报告的症状）；表单 priceUSD 与 API prices[] 不匹配的遗留 bug 一并修复（repeaterInput prices）
- **structured_reveal 分步交付（§6.2）**：processFulfillment 交付时落 deliveries 行（revealCount 统计）；公开订单 API 按 deliveryStrategy 返回——one_time_reveal 直接给 secret，structured_reveal 给掩码 + deliveryRowId；新增 POST /api/public/orders/:orderNumber/delivery/reveal（校验已支付 → revealCount+1/first/lastRevealedAt → 返回全部解密卡密，rate limit 30/min）；结账页分步 UI（掩码行 + "显示完整内容"按钮）

## 3. 新增文件

~~~text
server/repositories/migrations/0017_product_image.sql (+meta)
server/api/admin/store/products/[id].get.ts / [id].put.ts
server/api/public/orders/[orderNumber]/delivery/reveal.post.ts
app/components/public/ProductImage.vue（默认占位图）
~~~

## 4. 验证结果

~~~text
npm run lint      → PASS
npm run typecheck → PASS
npm test          → PASS（167 tests / 21 files）
npm run build     → PASS
真实 MySQL E2E    → PASS（见 §5）
~~~

## 5. 真实环境 E2E（Laragon MySQL 8.0.30）

- 后台 /admin/store/products：路由修复后正常进入，列表渲染商品行（此前 404 / 加载中卡死两个症状均消除），browser-use 快照确认
- 图片链路：media upload → PUT imageMediaId → 公开 API image.url → GET /media/:key 200 → /store SSR HTML 输出 <img>（curl 验证；无图商品渲染内置占位）
- structured_reveal 全链路：下单 → mock 支付 → webhook → 公开订单 API 返回掩码（E2E-••••-1-6，无 secret）→ POST reveal → 解密卡密 + deliveries.reveal_count=1/first_revealed_at 落库

## 6. 修复记录（E2E 揪出的问题）

- 公开订单 API 局部数组 `deliveries` 遮蔽同名导入的 drizzle 表 → select 字段 undefined → 500（orderSelectedFields）；重命名 deliveryList
- 订单接口交付条目原以库存项 id 为键，reveal 端点按交付行 id 查 → 404；结构化条目补 deliveryRowId
- 排障插曲：MySQL 宕机期间启动的 degraded dev 实例抢占 3000 端口，新实例被挤到 3001，造成"登录 401/商品为空"假象——同一端口双实例问题，注意 get-port 降级日志

## 7. 完成记录

~~~text
Phase Status: COMPLETE
Acceptance: PASS（四道闸门 + 真实环境端到端）
Known Issues: 结构化交付的 reveal 为整单粒度（一次显示全部卡密），未做单条分步
Follow-up: P14 Export and Hardening
~~~
