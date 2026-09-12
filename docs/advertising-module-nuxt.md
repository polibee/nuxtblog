# Nuxt Full-stack Advertising Module 开发实施文档

> 本文档是广告模块的唯一开发依据。此前的 React Router 版本（route loader/action、React Component、app/routes/**、app/modules/advertising/** 等）已全部废弃，不作为开发依据。所有技术实现按 Nuxt / Vue / Nitro。

## 1. 定位与核心思想

沿用架构文档 §8 保留的设计思想：

1. 页面只声明 `<AdSlot name="..." />`，广告内容不散落在页面组件
2. Slot 与 Campaign / Creative 解耦：Slot 是页面上的"空位"，投放关系由 Placement 决定
3. 会员免广告统一由 Decision Service 判断，业务代码不感知
4. 广告 Provider 可替换（自有图片广告 / Google AdSense / 联盟广告）
5. CDN/SSR 缓存场景下**不把用户会员状态写进公共 SSR HTML**：SSR 只输出占位符，广告数据由客户端批量 resolve

## 2. 目录结构（本仓库实际约定）

```text
app/modules/advertising/
├── components/
│   ├── AdSlot.vue            # 页面声明 <AdSlot name="sidebar-ad">
│   ├── AdRenderer.vue        # 按 payload.kind 分发
│   ├── ImageAd.vue           # 自有图片广告
│   ├── AffiliateAd.vue       # 联盟广告（图片/文案 + 跳转）
│   └── AdsenseAd.vue         # AdSense 代码位
├── composables/
│   └── useAdvertising.ts     # 注册 slot → 批量 resolve-batch → 共享结果
├── types/
│   └── advertising.ts        # AdPayload / AdResult / ResolveRequest
└── constants/
    └── ad-slots.ts           # 代码内置 slot key 清单（boot seed 依据）

server/modules/advertising/
├── advertising.service.ts    # resolve / resolveBatch / recordClick（唯一入口）
├── decision.service.ts       # NO_AD 决策链 + 会员 ad_free
├── placement.service.ts      # slot → placements → campaign 查询
├── creative.service.ts       # 创意 + locale translation 取数、加权选择
├── campaign.service.ts       # campaign 状态/时间窗
├── provider-registry.ts      # provider → payload 渲染
└── providers/
    ├── image.provider.ts
    ├── adsense.provider.ts
    └── affiliate.provider.ts

server/api/advertising/
├── resolve.post.ts           # 单 slot 决策
├── resolve-batch.post.ts     # 多 slot 批量决策（页面级一次请求）
└── click/
    └── [creativeId].get.ts   # 点击计数 + 302 跳转

server/repositories/schema/advertising.ts   # ORM
server/repositories/migrations/0022_advertising.sql
app/modules/advertising/admin/  # NuxtAdmin Resources（见 §7）
```

说明：目录按本仓库既有规范落在 `server/modules/**`（等价于通用方案中的 `server/services/**`），后台管理使用 NuxtAdmin Resource（`app/modules/advertising/admin/**`，等价于独立 `pages/admin/advertising/**`），不重复造一套。

## 3. 数据模型（迁移 0022）

```text
ad_slots                     # 广告位（页面空位）
├── id, key(unique), name, enabled, created_at, updated_at

ad_placements                # 投放：slot ↔ campaign
├── id, slot_key, campaign_id FK, priority, enabled, created_at, updated_at

ad_campaigns                 # 计划
├── id, name, status(draft|active|paused|ended), start_at, end_at,
├── created_at, updated_at

ad_creatives                 # 创意（机器字段）
├── id, campaign_id FK, provider(image|adsense|affiliate), weight,
├── impressions, clicks, enabled, created_at, updated_at

ad_creative_translations     # 创意多语言内容
├── id, creative_id FK cascade, locale_id FK,
├── title, content, button_text, image_id(media), target_url, alt_text,
├── unique(creative_id, locale_id)

membership_plans             # 追加 features 列（JSON 数组）
├── + features text          # e.g. '["ad_free"]'；Decision Service 据此免广告
```

多语言：新增 `en-US`、`ja-JP` 只需新增 Locale 与 Translation 数据行，不改代码。

## 4. 展示与决策链路（正式定案）

```text
Nuxt Public Page
      │ <AdSlot name="sidebar-ad" />
      ▼
SSR 输出空占位（不携带任何用户/会员信息）
      │ onMounted
      ▼
useAdvertising()（app/modules/advertising/composables）
      │ 同页多 AdSlot 聚合，一次请求
      ▼
$fetch('/api/advertising/resolve-batch', { slots, path })
      ▼
Nitro → AdvertisingDecisionService
      ├─ setting advertising.enabled = false        → NO_AD
      ├─ slot 不存在 / disabled                     → NO_AD
      ├─ path 命中 advertising.excluded_paths        → NO_AD
      ├─ 登录用户持 active 订阅且计划 features 含
      │  ad_free                                    → NO_AD
      ▼
Placement(priority) → Campaign(active + 时间窗)
      → Creative(加权随机) → locale Translation（缺省回退默认语言）
      → Provider Registry → 结构化 payload
      ▼
 impressions +1（fire-and-forget）
      ▼
客户端 AdRenderer 渲染
```

缓存策略：`resolve-batch` 为客户端请求（带 cookie），会员状态不进 SSR HTML；服务端对「匿名可达」的 (slot, locale) 候选创意做 60s 内存缓存（pageCache 同款思路）；会员请求绕过缓存直接 NO_AD。点击走 `/api/advertising/click/[creativeId]` 计数 + 302。

## 5. Provider 契约

`provider-registry.ts`：`{ image, adsense, affiliate }` → `(creative, translation) => AdPayload`

- image：`{ kind:'image', title, imageUrl, targetUrl, buttonText?, altText? }`
- affiliate：同 image（targetUrl 为联盟链接，click 端点不改写）
- adsense：`{ kind:'adsense', client, slot, code }`（code 为管理员粘贴的完整代码）

`AdPayload` 全部经 `validateUploadMime` 同源的 media 图片或外链 URL，targetUrl 仅允许 http(s) 或站内路径（复用 §12 安全边界）。

## 6. API

```text
POST /api/advertising/resolve         { slot, path }        → AdResult
POST /api/advertising/resolve-batch   { slots[], path }     → { results: Record<slot, AdResult> }
GET  /api/advertising/click/:creativeId?target=             → 计数 + 302
```

Admin（RBAC：`advertising.*`，复用 NuxtAdmin 分页契约）：

```text
GET/POST      /api/admin/advertising/slots        GET/PUT/DELETE /api/admin/advertising/slots/:id
GET/POST      /api/admin/advertising/campaigns    GET/PUT/DELETE /api/admin/advertising/campaigns/:id
GET/POST      /api/admin/advertising/creatives    GET/PUT/DELETE /api/admin/advertising/creatives/:id
GET/POST      /api/admin/advertising/placements   GET/PUT/DELETE /api/admin/advertising/placements/:id
```

## 7. 后台管理（NuxtAdmin Resource）

`app/modules/advertising/admin/`：

- AdSlotsResource（name `advertising/slots`）— key/name/enabled
- AdPlacementsResource（`advertising/placements`）— slot select + campaign select + priority/enabled
- AdCampaignsResource（`advertising/campaigns`）— name/status/start_at/end_at
- AdCreativesResource（`advertising/creatives`）— campaign select + provider select + weight/enabled + localizedInput（title/content/button_text/alt_text）+ mediaPicker(image_id) + target_url

全部走 defineResource 标准表格/表单，服务端 RBAC。

## 8. 页面接入

```vue
<AdSlot name="sidebar-ad" />
```

`constants/ad-slots.ts` 内置 `sidebar-ad`、`post-bottom`；boot seed 演示 Slot + Campaign + Image Creative（指向 /membership）保证首屏可见。

## 9. 阶段验收标准

```text
P17.1 文档（本文档）
P17.2 迁移 0022 + ORM + 仓储
P17.3 Decision Service + Provider Registry + 3 个 Nitro API
P17.4 AdSlot/useAdvertising/Renderer 组件 + 公开侧边栏接入 + boot seed
P17.5 后台 4 个 Resource + Admin API
P17.6 闸门（lint/typecheck/test/build）+ E2E：
  - 未登录 resolve-batch 返回 image payload
  - active 会员(ad_free) 返回 NO_AD
  - click 计数 +1 并 302
  - 后台 CRUD 往返
```


## 10. 实施结果（2026-09-11）

全部阶段完成，真实 MySQL E2E 通过：

- 迁移 0022 应用（5 张 ad_* 表 + membership_plans.features）
- boot seed：sidebar-ad/post-bottom 两个 Slot + 演示计划/创意/投放（双语）
- 游客 resolve-batch → image payload（title=开通会员，target=/membership）
- 会员（active 订阅 + features 含 ad_free）→ NO_AD reason=member_ad_free
- click 端点 → clicks +1，302 到 /membership
- 后台 4 个 Resource（slots/campaigns/creatives/placements）CRUD 正常
- 公开侧边栏已接入 <AdSlot name="sidebar-ad">（/layouts/public.vue）

后续可选：placements 的日期排期 UI、campaign 预算/频次上限、AdSense 脚本异步加载策略。
