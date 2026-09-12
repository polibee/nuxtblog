# P15 Membership, Paid Content and Media/Editor Upgrades

## 1. 基本信息

~~~text
Phase ID: P15
Phase Name: Membership + Paid Content + 媒体库分类 + 编辑器三模式（用户需求驱动）
Owner: polibee
NuxtAdmin Base Commit: a48695f
Depends On: P13 系列、P14
Target Version: v0.2.0-p15
Status: COMPLETE
~~~

## 2. 实现范围

### 用户报告的 Bug
- **GET /api/admin/tags 500**（存量）：0012 别名统一删除了 DB 的 tag_translations.slug 列，但 Drizzle schema 残留该列 → SELECT * 引用不存在的列。移除 schema 中的幽灵列即愈（categories 本就正常）。

### 媒体库分类（P15.1）
- 迁移 0019：`media_folders` + `media.folder_id`（可空、无外键——删除分类仅把媒体置为未分类）
- API：GET/POST /api/admin/media/folders、DELETE :id；media 更新接受 folderId（列表支持 folderId 过滤）
- 后台：媒体分类独立 Resource（标准 CRUD）+ 媒体编辑弹层里 folderId 下拉

### 特色图片弹窗选图（P15.2，ADR 0004）
- FormField 新增 `mediaPicker` 字段类型（值 = media id）：弹窗网格（分页 40/页 + 分类过滤 + 加载更多），点击选中、缩略图预览、可清除
- PostResource `featuredMediaId` 从 relationInput 下拉迁移为 mediaPicker；存量数字 id 兼容

### 编辑器三模式 + 加宽（P15.3，ADR 0004）
- RichTextEditor 顶部 tab：富文本 / Markdown / 预览；Markdown↔HTML 用 turndown + marked 双向转换；预览渲染 markdownSource
- 编辑区高度 160px→416px（min-h-[26rem]），Markdown textarea rows=20
- `[paid]` 工具栏按钮：弹窗设置价格（最小单位+币种），插入 `[paid]…[/paid]` 标记，并通过 vee-validate 表单上下文（useForm() 注入）把 accessType/paidPriceMinor/paidCurrency 写入文章表单同级字段

### 付费内容 + 会员（P15.4）
- 迁移 0020：posts.paid_price_minor/paid_currency；membership_plans(+translations)；subscriptions；post_purchases
- **影子商品桥接**：会员计划/付费文章各映射一个 published 影子商品（alias `plan-{id}` / `post-{id}`，product_type 'membership'|'post_access'，惰性创建+价格同步），下单→支付→webhook 全链路 100% 复用 P13 网关
- **授权分发**：processFulfillment 对影子类型跳过库存、写入 post_purchases（order 身份）/续期 subscriptions（current_period_end 向前叠加，月/年）
- **拦截**：公开文章 API 按 access_type 拆分——`[paid]` 前免费段所有人可见，付费段仅购买者/有效会员可得（locked+price 元数据）；members 全文拦截；PostDetail 渲染付费提示 + "购买全文"按钮 → 标准结账
- 会员计划后台 Resource（/admin/membership/plans）+ 公开 JSON（/api/public/membership/plans）；公开商店列表排除影子商品

## 3. 新增文件

~~~text
server/repositories/migrations/0019_media_folders.sql / 0020_membership_paid_posts.sql (+meta)
server/repositories/schema/{media 增补, membership.ts}
server/modules/membership/membership.service.ts
server/api/admin/media/folders/*、server/api/admin/membership/plans/*、server/api/public/membership/plans.get.ts
app/admin/framework/MediaPickerField.vue
app/modules/{exports 已有, membership/*}、媒体分类 Resource
docs/adr/0004-media-picker-editor-modes.md
~~~

## 4. 验证结果

~~~text
npm run lint      → PASS（仅剩 1 条 v-html warning：预览渲染所需，已注释说明）
npm run typecheck → PASS
npm test          → PASS（167 tests / 21 files）
npm run build     → PASS
真实 MySQL E2E    → PASS 7/7（§5）
~~~

## 5. 真实环境 E2E（Laragon MySQL 8.0.30）

1. 登录 200；2. tags 200（修复验证）；3. 创建媒体分类 200；4. 分类列表含 product-images；5. 公开会员计划（UTF-8 中文名正常）；6. 游客访问付费文章 locked=true 且带价格；7. 会员（active subscription）同文 locked=false
- 会员购买闭环：建计划 → 公开计划页惰性建影子商品 → 下单 → mock 支付 → webhook → subscriptions active（user 1，月度到期 2026-10-10）
- 单篇购买闭环：访问文章惰性建 post-2 影子商品 → 下单支付 → post_purchases 授权（user_id/email）→ 已购用户 locked=false

## 6. 修复记录（E2E 揪出）

- 影子商品惰性创建无人调用 → 下单 404；挂在公开计划/文章读取上
- membership 原生 raw sql 查 orders 导致 user_id 取不到（列名 user_id ≠ userId）→ 改类型化查询
- post_purchases 授权缺 user/email → 补 order 身份
- 中文 JSON 内联 curl 乱码（已知坑）→ UTF-8 文件 + --data-binary

## 7. 追加：公开会员计划落地页（同日补齐）

- `/membership` 公开页（public 布局）：计划卡片（名称/描述/价格+周期），"立即开通" → 未登录跳登录（redirect 回来）→ 登录后下单跳标准结账；商店页副标题加入口链接
- 浏览器快照验证渲染正常；会员闭环（登录→开通→checkout→支付→订阅生效）此前 E2E 已通

## 8. 完成记录

~~~text
Phase Status: COMPLETE
Acceptance: PASS（四道闸门 + 真实环境端到端 7/7）
Known Issues: 预览模式 v-html 仅在编辑器内部（写入时服务端已 sanitize）；会员订阅续费为手动再次购买（无自动扣款——网关无 vault 能力）
Follow-up: 路线图 P16+（Advertising/AI/Theme/Plugin）或用户需求
~~~
