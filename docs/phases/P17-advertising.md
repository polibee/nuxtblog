# P17 Advertising（Nuxt Full-stack）

## 1. 基本信息

~~~text
Phase ID: P17
Phase Name: 广告管理模块（Nuxt Full-stack）
Owner: polibee
NuxtAdmin Base Commit: a48695f
Depends On: P15（会员）、P13 系列（网关链路无关，但复用安全边界）
Target Version: v0.2.0-p17
Status: COMPLETE
实施文档：docs/advertising-module-nuxt.md（含目录结构、决策链路、API、缓存策略、阶段验收）
~~~

## 2. 实现范围（摘要）

- **决策链路**：全局开关（advertising_enabled setting）→ Slot 开关 → 页面排除（advertising_excluded_paths）→ 会员 ad_free（membership_plans.features JSON 含 "ad_free" + active 订阅）→ NO_AD；否则 Placement(priority) → Campaign(active+时间窗) → Creative(加权随机) → locale Translation（默认语言回退）→ Provider payload
- **缓存**：匿名可达候选创意 60s 内存缓存（按 slot+locale）；会员请求绕过缓存；会员状态不进 SSR HTML（SSR 空占位 + 客户端 resolve-batch）
- **Provider Registry**：image / affiliate / adsense，可替换（server/modules/advertising/providers/）
- **数据层**：迁移 0022（ad_slots / ad_placements / ad_campaigns / ad_creatives / ad_creative_translations + membership_plans.features）
- **API**：resolve / resolve-batch / click/:creativeId（计数+302）；Admin CRUD ×4（slots/campaigns/creatives/placements）
- **后台**：广告模块 4 个 Resource（slots/campaigns/creatives/placements），创意支持多语言内容 + mediaPicker 选图
- **前端**：AdSlot（声明空位）→ useAdvertising（同页批量 resolve-batch 调度）→ AdRenderer（按 payload.kind 分发 ImageAd/AffiliateAd/AdsenseAd）；公开侧边栏已接入 sidebar-ad

## 3. 验证结果

~~~text
npm run lint      → PASS（0 errors）
npm run typecheck → PASS
npm test          → PASS（167 tests / 21 files）
npm run build     → PASS
真实 MySQL E2E    → PASS
~~~

## 4. 真实环境 E2E（Laragon MySQL 8.0.30）

- 迁移 0022 应用（5 张 ad_* 表 + features 列）；boot seed 写入 2 slot + 演示计划/创意/投放（双语）
- 游客 resolve-batch → image payload（开通会员 → /membership）；post-bottom 无投放 → NO_AD
- 会员 ad_free：active 订阅 + features=["ad_free"] → NO_AD reason=member_ad_free
- click 端点 → clicks+1，302 到 /membership
- 后台 4 个 Resource CRUD 正常；公开侧边栏渲染 AdSlot

## 5. 完成记录

~~~text
Phase Status: COMPLETE
Acceptance: PASS（四道闸门 + 真实环境端到端）
Known Issues: Adsense 需真实 client/slot 配置才能出广告；impression 计数为 fire-and-forget
Follow-up: placements 排期 UI、campaign 频次上限、广告报表页
~~~
