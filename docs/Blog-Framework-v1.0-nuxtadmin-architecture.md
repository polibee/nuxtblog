# 博客框架 v1.0
# Nuxt 4 + NuxtAdmin 全栈架构与开发文档

**文档状态：** Architecture Baseline  
**后台基座：** D:/codex/nuxtadmin，当前基线 a48695f  
**全栈：** Nuxt 4 + Nitro + Vue 3.5 + TypeScript  
**数据库：** MySQL 8.x  
**生产数据层：** Drizzle ORM + Repository  
**默认语言：** zh-CN  
**开发阶段：** 只启用 zh-CN，数据库第一天支持动态内容多语言  
**统计方案：** 站内一方统计，匿名优先，原始事件 + 会话 + 日聚合

---

## 1. 文档目标

本文档定义一个可复用博客框架的 Nuxt 全栈实现，并以本地 D:/codex/nuxtadmin 为后台基座，冻结：

- Nuxt/Nitro 全栈分层和目录
- NuxtAdmin 的复用边界与扩展方式
- Blog Core、Commercial Core、Extension Layer 的依赖
- Entity + Translation 多语言模型
- SEO、公开路由、缓存和统计采集规则
- Analytics/SEO 流量统计的数据模型、API、报表和隐私边界
- Phase 顺序、验收标准和生产替换项

NuxtAdmin 自身的通用框架规则以本地仓库的 docs/开发指南.md 和实际源码为准；本文档只定义博客框架的业务接入。

## 2. 产品定位与边界

博客框架是：

~~~
单站点个人博客
+ 会员商业化
+ 可扩展多语言
+ SEO 流量统计
~~~

v1 不做：

- SaaS、多租户、多站点
- Creator Platform
- WordPress/Strapi 的完整替代品
- 插件市场、主题市场
- 复杂作者协作、作者结算和广告竞价

初始只有一个管理员，管理员同时是文章作者。保留 author_id、uploader_id、user_id 等归属字段，但不在 v1 构建多作者平台。

## 3. NuxtAdmin 基座边界

### 3.1 复用能力

NuxtAdmin 已提供并应优先复用：

- defineModule、defineResource 和 Registry
- Resource 列表/创建/详情/编辑页
- REST CRUD、RBAC、导航、Action、Widget
- 媒体库、Taxonomy、Menu、Settings
- 草稿/审核/排期/发布/归档生命周期
- Revision、Draft Preview、Autosave
- Tiptap、VeeValidate + Zod、TanStack Table Vue
- SEO 字段、Sitemap、RSS、公开设置
- 页面缓存、缓存监控、事件总线、Webhook

### 3.2 博客框架新增

博客框架负责：

- MySQL Migration 和真实 Repository
- Locale Registry 与 Content Translation
- Posts、Pages、Category、Tag、Navigation 业务模型
- Membership、Payments、Paid Content、Advertising
- Analytics/SEO 流量统计
- 公开博客页面、多语言 URL 和 SEO 规则

### 3.3 基座生产替换项

当前 NuxtAdmin 基线的以下实现是开发/演示实现，不能直接用于线上：

~~~
server/utils/db.ts    内存集合和 Seed 数据
server/utils/auth.ts  演示账号和内存 Token
server/utils/kv.ts    开发态 KV/缓存
~~~

上线前必须：

1. 用 MySQL + Drizzle Repository 替换内存仓储。
2. 用真实数据库 Session、JWT/OAuth 或外部身份服务替换演示认证。
3. 配置 HTTPS、secure Cookie、CSRF 或 Bearer 方案。
4. 增加登录/API/Analytics 采集限流。
5. 将媒体存储和 Redis 换成生产持久化设施。

## 4. 总体架构

~~~
Browser
  ↓
Nuxt App / Vue Pages / Components
  ├─ useFetch / useAsyncData
  ├─ Composables
  └─ app middleware
        ↓
      Nitro Server
      ├─ server/api/**       API Handler
      ├─ server/routes/**    sitemap/rss/公开动态路由
      ├─ server/middleware   请求级上下文与安全
      ├─ server/modules/**   Service/Repository/Policy
      └─ server/utils/**     基础设施适配器
        ↓
      Drizzle ORM
        ↓
      MySQL 8.x
~~~

后台链路：

~~~
app/plugins/admin.ts
  ↓ registerModule()
app/modules/<domain>/module.ts
  ↓ defineResource()
app/pages/admin/[...path].vue
  ↓ ResourceList/Form/ViewPage
server/api/admin/[resource]/**
  ↓ auth + permission + validation
server/modules/<domain>/*
  ↓ repository
MySQL
~~~

前台和后台路由分离：

~~~
/admin/**             NuxtAdmin 后台
/api/admin/**         后台 API
/api/public/**        公开数据 API
/api/analytics/**     统计采集/报表 API
/sitemap.xml          Sitemap
/rss.xml              RSS
/posts/**             文章
/pages/**             页面
~~~

## 5. NuxtAdmin 接入规范

### 5.1 模块注册

博客业务模块放在 app/modules/。典型模块：

~~~text
analytics
dashboard
media
navigation
pages
posts
taxonomy
~~~

由 app/plugins/admin.ts 统一注册。模块 Label、列名、表单标签和状态文案使用现有 defineModule(t => ...) 模式，不写死中文。

### 5.2 Resource 复用

普通 CRUD 资源使用：

~~~text
defineResource({
  name,
  model,
  label,
  labelPlural,
  icon,
  group,
  permissionPrefix,
  searchable,
  table,
  form,
  infolist,
  rowActions,
  bulkActions
})
~~~

Resource 负责后台展示和权限入口；Entity/Translation 跨表事务由博客领域 Service 保证。

### 5.3 多语言资源

Posts、Pages、Category、Tag、Media、Navigation 不是一张平面记录，不能把 Translation 当作普通 JSON 随意写入。

增加通用框架扩展：

~~~text
LocalizedField
├── LocaleTabs
├── TranslationStatus
├── MissingTranslationBadge
└── 当前 Locale 字段校验
~~~

输入结构：

~~~text
translations[locale][field]
~~~

保存时由 Service 在一个数据库事务内拆分写入 Entity 与 Translation 表。LocalizedField 不写死 Posts，应成为 NuxtAdmin 通用扩展；如果暂时不上游，则 Posts/Pages 使用自定义资源编辑页。

### 5.4 API 路由

当前基座的通用路由：

~~~text
server/api/admin/[resource]/index.get.ts
server/api/admin/[resource]/index.post.ts
server/api/admin/[resource]/[id].get.ts
server/api/admin/[resource]/[id].put.ts
server/api/admin/[resource]/[id].delete.ts
server/api/admin/[resource]/bulk-delete.post.ts
~~~

特殊动作：

~~~text
server/api/admin/[resource]/[id]/<action>.post.ts
~~~

不要创建会遮蔽 [resource] 动态路由的静态资源目录。复杂业务仍复用相同 Service、权限和事件管线。

### 5.5 Server 显式 import

跨文件使用 server/utils/* 必须显式 import。不得依赖 Nitro 自动导入，否则可能产生多个模块实例，导致一个 Handler 写入、另一个 Handler 读取不到同一状态。

## 6. 目录结构

~~~text
app/
├── admin/
│   ├── core/                  NuxtAdmin 基座，尽量不改
│   ├── framework/             通用渲染器，尽量不改
│   ├── ui/                    UI 原子组件
│   └── extensions/
│       └── localized-field/   通用多语言字段
├── components/
│   ├── public/
│   ├── shared/
│   └── analytics/
├── composables/
│   ├── useAnalytics.ts
│   ├── useContentTranslation.ts
│   └── useLocale.ts
├── layouts/
│   ├── default.vue
│   ├── public.vue
│   └── admin.vue
├── middleware/
│   └── locale.global.ts
├── modules/
│   ├── analytics/
│   ├── advertising/
│   ├── comments/
│   ├── dashboard/
│   ├── media/
│   ├── membership/
│   ├── navigation/
│   ├── pages/
│   ├── paid-content/
│   ├── payments/
│   ├── posts/
│   ├── settings/
│   ├── taxonomy/
│   └── users/
├── pages/
│   ├── admin/[...path].vue
│   ├── login.vue
│   ├── index.vue
│   ├── posts/[slug].vue
│   ├── category/[slug].vue
│   ├── tag/[slug].vue
│   └── [...publicPath].vue
└── plugins/
    ├── admin.ts
    └── analytics.client.ts

server/
├── api/
│   ├── admin/
│   ├── analytics/
│   │   ├── collect.post.ts
│   │   └── report/
│   ├── auth/
│   └── public/
├── routes/
│   ├── sitemap.xml.get.ts
│   └── rss.xml.get.ts
├── modules/
│   ├── analytics/
│   │   ├── analytics.service.ts
│   │   ├── analytics.repository.ts
│   │   ├── analytics.parser.ts
│   │   ├── analytics.policy.ts
│   │   └── analytics.rollup.ts
│   ├── posts/
│   ├── pages/
│   └── taxonomy/
├── repositories/
│   ├── db.server.ts
│   └── locale.repository.ts
└── utils/
    ├── auth.ts
    ├── cache.ts
    ├── events.ts
    ├── locale.ts
    └── security.ts

shared/
├── types/
│   ├── analytics.ts
│   ├── api.ts
│   └── locale.ts
└── schemas/
    ├── analytics.ts
    └── locale.ts
~~~

## 7. 模块依赖

~~~text
Core
 ├── Auth / Security / DB / Storage / Locale / Format
 └── Cache / Logger / Events

Blog Core
 ├── Posts ── Taxonomy ── Media
 ├── Pages ── Media
 ├── Navigation ── Pages / Posts / Taxonomy
 └── Comments ── Posts / Users

Analytics
 ├── Public Pages / Locale / Referrer / UTM
 └── NuxtAdmin Dashboard / RBAC

Commercial Core
 ├── Membership
 ├── Payments
 ├── Paid Content ── Posts + Membership
 └── Advertising ── Membership + Media
~~~

Analytics 不得成为 Posts、Payments、Membership 的硬依赖。统计失败不能阻断页面访问和内容发布。

## 8. 多语言架构

### 8.1 UI i18n 与 Content Localization

~~~text
UI i18n              后台/系统界面
Content Localization 文章/页面/分类等内容
~~~

后台 UI 可以只有中文，同时编辑英文内容。

### 8.2 Locale Registry

~~~text
locales
├── id
├── code
├── name
├── native_name
├── url_prefix
├── enabled
├── content_enabled
├── ui_enabled
├── is_default
├── fallback_locale_id
├── sort_order
├── created_at
└── updated_at
~~~

约束：

~~~text
UNIQUE(code)
UNIQUE(url_prefix)
最多一个 is_default=true
content_enabled=true 必须 enabled=true
ui_enabled=true 必须 enabled=true
~~~

开发阶段只 Seed：

~~~text
code=zh-CN
url_prefix=""
enabled=true
content_enabled=true
ui_enabled=true
is_default=true
~~~

### 8.3 Entity + Translation

禁止：

~~~text
title_zh / title_en
name_zh / name_en
~~~

使用：

~~~text
posts + post_translations
pages + page_translations
categories + category_translations
tags + tag_translations
~~~

Translation 通用约束：

~~~text
UNIQUE(entity_id, locale_id)
UNIQUE(locale_id, slug)  -- 有 Slug 的实体
INDEX(locale_id)
~~~

关系表永远关联 Entity ID，不关联 Translation ID。

### 8.4 Primary Locale

可本地化核心 Entity 增加 primary_locale_id：

- 创建时默认系统 Locale。
- 管理员可以选择其他已启用 Content Locale。
- Entity 至少有 Primary Locale 的完整 Translation 才能发布。
- 其他 Locale 可稍后补齐或独立发布。
- 公开读取严格按请求 Locale，不把中文输出到英文 URL。

## 9. 核心内容模型

### 9.1 Posts

~~~text
posts
├── id
├── primary_locale_id
├── author_id
├── featured_image_id
├── access_type       public | members
├── status            draft | scheduled | published | archived
├── published_at
├── scheduled_at
├── comment_status
├── created_at
├── updated_at
└── deleted_at

post_translations
├── id
├── post_id
├── locale_id
├── title
├── slug
├── excerpt
├── content
├── seo_title
├── seo_description
├── canonical_url
├── noindex
├── featured_image_id nullable
├── created_at
└── updated_at
~~~

NuxtAdmin PostResource 复用列表、状态 Badge、Preview、Action、Revision、Rich Text；编辑页提交 translations[locale]，Post Service 事务写入两类表。

### 9.2 Pages、Taxonomy、Media、Navigation

~~~text
pages + page_translations
categories + category_translations
tags + tag_translations
media + media_translations
navigations + navigation_items + navigation_item_translations
~~~

Page 的 template 属于 Entity，不翻译。Category/Tag 关系绑定 Entity。Media 文件本体不随语言复制，Alt/Caption 进入 Translation。Navigation 引用 Entity，按当前 Locale 解析目标 Slug。

### 9.3 Settings、Membership、Payments、Advertising

NuxtAdmin Settings 复用分组表单和公开/私密隔离，新增 localized_settings。

Membership Plan 的价格、货币、周期和机器 Feature 在 Entity；名称、描述、Feature 展示说明在 membership_plan_translations。

Payment 只保存机器状态：

~~~text
pending | processing | paid | failed | canceled | refunded
~~~

Paid Content 默认作用于 Post Entity：

~~~text
posts.access_type = public | members
~~~

Ad Slot 使用机器 Key；广告标题、正文、按钮、语言图片和语言目标 URL 进入 ad_translations。

## 10. SEO、路由与缓存

统一调用 resolveLocale(request)，之后内容查询必须显式带 locale：

~~~text
getPostBySlug({ locale, slug })
~~~

开发阶段仅开放默认 Locale 无前缀。未来默认 Locale 无前缀，其他 Locale 使用 locales.url_prefix。

复用 NuxtAdmin 的 SEO 字段、noindex、Sitemap、RSS、Preview 和公开端点缓存；博客框架增加按 Locale 生成 Sitemap/RSS、当前语言 canonical、hreflang 和 Translation 完整性过滤。

~~~text
page:{locale}:{path}
sitemap:{locale}
rss:{locale}
post:translation:{postId}:{locale}
~~~

修改英文 Translation 只失效英文页面及其相关聚合缓存。

## 11. Analytics/SEO 流量统计

### 11.1 目标与范围

统计：总访问量、会话、匿名访客、搜索/社交/外部/UTM/直接来源、入口页、热门页、退出页、设备、浏览器、OS、Viewport、Locale、日/小时趋势。

v1 不做鼠标轨迹、录屏、热力图、默认表单采集、默认身份关联、默认跨站追踪和精确地理位置。

### 11.2 数据流

~~~text
公开页面
  ↓ app/plugins/analytics.client.ts
useAnalytics()
  ↓ sendBeacon/fetch
POST /api/analytics/collect
  ↓ 校验 / Consent / DNT / GPC / Bot / Rate Limit
Referrer + UTM + Device 标准化
  ↓
Analytics Service
  ├── analytics_events
  ├── analytics_sessions
  └── rollup job
        ↓
      analytics_daily_*
        ↓ RBAC
      NuxtAdmin Analytics Dashboard
~~~

采集失败不能影响页面、登录、导航或发布。

### 11.3 客户端插件与匿名标识

~~~text
app/plugins/analytics.client.ts
app/composables/useAnalytics.ts
~~~

只在公开前台运行，不统计 /admin/**、/api/**、/preview/**、Bot、本地开发请求。

事件：

~~~text
page_view   首次加载或 SPA 路由变化
page_exit   pagehide/visibilitychange 尽力发送
heartbeat   v1 可关闭或低频发送
~~~

优先 navigator.sendBeacon，失败才用短超时 fetch。每个事件有 event_id，服务端去重。

~~~text
visitor_id  随机第一方 ID，默认 30 天
session_id  30 分钟无活动过期
~~~

禁止将 email、姓名、手机号、明文 IP、Authorization、Cookie 内容或表单内容写入 Analytics。User-Agent 在服务端解析后只保存设备/浏览器/OS 结果。

### 11.4 事件契约

~~~text
event_id
event_type
occurred_at
path
route_name nullable
page_title nullable
locale_code
content_type nullable
content_id nullable
referrer_url nullable
utm_source nullable
utm_medium nullable
utm_campaign nullable
utm_term nullable
utm_content nullable
viewport_width_bucket nullable
viewport_height_bucket nullable
visitor_id
session_id
consent_state
~~~

服务端重新校验 device_type、is_bot、来源分类和 Content Entity，不信任客户端值。

### 11.5 数据表

#### analytics_events

~~~text
id bigint
event_id varchar(64) unique
event_type varchar(32)
occurred_at datetime
received_at datetime
session_key varchar(128)
visitor_key varchar(128)
path varchar(2048)
route_name varchar(128) nullable
page_title varchar(512) nullable
locale_id bigint nullable
content_type varchar(32) nullable
content_id bigint nullable
referrer_domain varchar(512) nullable
referrer_path varchar(2048) nullable
utm_source varchar(256) nullable
utm_medium varchar(256) nullable
utm_campaign varchar(256) nullable
utm_term varchar(256) nullable
utm_content varchar(256) nullable
device_type varchar(32) nullable
browser varchar(64) nullable
browser_version varchar(32) nullable
operating_system varchar(64) nullable
os_version varchar(32) nullable
viewport_bucket varchar(32) nullable
consent_state varchar(32)
is_bot boolean default false
created_at datetime
~~~

索引：

~~~text
UNIQUE(event_id)
INDEX(occurred_at)
INDEX(session_key, occurred_at)
INDEX(visitor_key, occurred_at)
INDEX(path, occurred_at)
INDEX(locale_id, occurred_at)
INDEX(referrer_domain, occurred_at)
~~~

#### analytics_sessions

~~~text
id bigint
session_key varchar(128) unique
visitor_key varchar(128)
started_at datetime
last_seen_at datetime
landing_path varchar(2048)
exit_path varchar(2048) nullable
landing_referrer_domain varchar(512) nullable
source varchar(128)
medium varchar(128)
campaign varchar(256) nullable
locale_id bigint nullable
device_type varchar(32) nullable
browser varchar(64) nullable
operating_system varchar(64) nullable
pageviews int
engaged_seconds int
is_bounce boolean
is_bot boolean
created_at datetime
updated_at datetime
~~~

#### 日聚合表

~~~text
analytics_daily_site_metrics
  metric_date, locale_id, pageviews, sessions,
  unique_visitors, bounces, engaged_seconds

analytics_daily_page_metrics
  metric_date, locale_id, path, content_type, content_id,
  pageviews, sessions, unique_visitors, entries, exits,
  bounces, engaged_seconds

analytics_daily_source_metrics
  metric_date, locale_id, source, medium, campaign,
  pageviews, sessions, unique_visitors, entries

analytics_daily_device_metrics
  metric_date, locale_id, device_type, browser, operating_system,
  pageviews, sessions, unique_visitors
~~~

### 11.6 来源与指标

来源优先级：

1. 合法 UTM
2. 搜索引擎 Referrer → search
3. 社交站点 Referrer → social
4. 其他外部域名 → referral
5. 无 Referrer/UTM → direct

~~~text
Page View      一次有效 page_view
Session        同一 session 30 分钟无活动前的事件集合
Unique Visitor 统计窗口内去重 visitor_id
Bounce         只有一个 Page View 且没有有效 engagement 的 Session
Entry Page     Session 第一条有效 Page View
Exit Page      Session 最后一条有效 Page View
Engaged Time   由 page_exit/heartbeat 尽力估算
~~~

报表必须显示时间范围、时区、Locale 筛选和指标定义。

### 11.7 API 与后台

~~~text
POST /api/analytics/collect

GET /api/analytics/report/overview
GET /api/analytics/report/sources
GET /api/analytics/report/pages
GET /api/analytics/report/devices
GET /api/analytics/report/locales
GET /api/analytics/report/realtime

POST /api/analytics/admin/rebuild-rollup
POST /api/analytics/admin/purge-raw
GET  /api/analytics/admin/retention
PUT  /api/analytics/admin/retention
~~~

报表需要 analytics.view；重算、删除和留存配置需要 analytics.manage。

新增 NuxtAdmin Analytics Module：

~~~text
app/modules/analytics/module.ts
app/modules/analytics/admin/AnalyticsResource.ts
app/modules/analytics/widgets/
~~~

后台页面：

~~~text
/admin/analytics
/admin/analytics/sources
/admin/analytics/pages
/admin/analytics/devices
/admin/analytics/locales
/admin/analytics/settings
~~~

复用 Widget、Card、Tabs、Select、Table、Skeleton、Empty、RBAC 和通知。

### 11.8 隐私、留存和安全

- 支持 analytics_enabled、DNT、GPC 和 Consent 模式。
- 需要同意时，未同意不创建持久 Visitor ID。
- 不保存原始 IP、完整 Query、Cookie 内容、Token、表单和 Authorization。
- Referrer 清洗 query，避免泄露 email、token、订单号。
- body 大小、事件数量、时间戳窗口、event_id 去重和限流在采集端执行。
- 默认过滤 Admin、Preview、Bot、健康检查和开发请求。
- 原始事件默认保留 90 天，聚合数据默认保留 24 个月。

这部分是产品隐私设计，不替代目标部署地区的法律审查。

## 12. Phase 路线图

~~~text
P00 Foundation + NuxtAdmin Integration
P01 Authentication + Users
P02 Settings + Locale Registry
P03 Media
P04 Posts + Taxonomy
P05 Pages
P06 Navigation
P07 Comments
P08 Dashboard
P09 Analytics + SEO Traffic
P10 Membership
P11 Payments
P12 Paid Content
P13 Advertising
P14 Tools / Backup
P15 AI Connector
P16 AI Features
P17 Theme API
P18 Plugin API
P19 System Hardening
P20 Multi-language Activation
~~~

### P00

锁定 NuxtAdmin commit，完成真实配置、MySQL/Drizzle Repository 抽象、Migration、公开 Layout、Locale 基础设施、LocalizedField 和测试基线。禁止把博客数据继续写入 demo db.ts。

### P01-P08

依次实现真实认证、Settings/Locale、Media、Posts/Taxonomy、Pages、Navigation、Comments 和 Dashboard。Dashboard 删除 Orders/Revenue 等演示 Widget，替换为 Posts、Comments、Cache 和系统状态摘要。

### P09 Analytics + SEO Traffic

依赖公开 Posts/Pages/Navigation 可访问，完成采集插件、事件契约、Referrer/UTM/Device Parser、Session、原始事件、日聚合、Report API、RBAC、Widget、留存、删除、隐私和反刷。

### P10-P20

实现商业化、Tools、AI、Theme、Plugin、安全加固和多语言公开激活。P20 只激活 Locale 路由、语言切换、hreflang、Sitemap、RSS、Search 和第二 UI 语言，不重构 Translation 表。

## 13. Phase 完成标准

~~~text
Schema
↓
Migration
↓
Repository
↓
Service
↓
Nuxt Server API / Server Route
↓
NuxtAdmin Resource / Widget / Page
↓
Public UI
↓
Unit / Integration Tests
↓
E2E
↓
Acceptance
↓
COMPLETE
~~~

每个 Phase 必须通过：

~~~text
npm run lint
npm run typecheck
npm test
npm run build
npx playwright test
~~~

并覆盖权限、空状态、错误状态、Migration/回滚、多语言、缓存和公开 SEO。COMPLETE 代表基线验收完成；破坏性变化必须新建 Enhancement 或 ADR。

## 14. v1.0 表目录

~~~text
locales
users
sessions
password_reset_tokens
settings
localized_settings
media
media_translations
posts
post_translations
categories
category_translations
tags
tag_translations
post_categories
post_tags
pages
page_translations
navigations
navigation_items
navigation_item_translations
comments
analytics_events
analytics_sessions
analytics_daily_site_metrics
analytics_daily_page_metrics
analytics_daily_source_metrics
analytics_daily_device_metrics
membership_plans
membership_plan_translations
memberships
subscriptions
payment_gateways
payments
payment_events
ad_slots
ads
ad_translations
ai_connectors
plugin_settings
~~~

## 15. Backup、生产与强制检查

Backup 必须保留所有 Entity、Translation、关系表和 analytics_daily_* 聚合表。原始 Analytics 事件可按留存策略排除，但必须在 Manifest 中声明，不能静默丢弃。

生产前必须确认：

~~~text
□ 真实 MySQL Repository
□ 真实认证和持久化 Session
□ HTTPS 和 secure Cookie
□ CSRF/Bearer 策略
□ 登录/API/Analytics 限流
□ Redis 和持久化 Media Storage
□ Backup/Restore 演练
□ Analytics 留存与删除任务
□ Playwright 关键路径
~~~

每个 Phase 额外检查：

~~~text
□ 是否新增自然语言字段并正确进入 Translation？
□ 是否写死 Locale？
□ 是否正确处理 Missing/Incomplete/Complete？
□ Cache Key 是否包含 Locale？
□ Analytics 是否过滤 Admin/Preview/Bot/开发请求？
□ 是否避免原始 IP、Cookie、表单和敏感 Query？
□ Analytics 失败是否不会阻断业务？
□ Report API 是否有 RBAC？
□ 是否依赖 NuxtAdmin demo db/auth？
□ 是否跨文件显式 import server/utils？
~~~

## 16. 参考基线

- 本地基座：D:/codex/nuxtadmin
- 当前基座 commit：a48695f
- 基座开发指南：D:/codex/nuxtadmin/docs/开发指南.md
- 基座工程审计：D:/codex/nuxtadmin/docs/工程审计报告.md
- Nuxt Server 目录：https://nuxt.com/docs/4.x/directory-structure/server
- Nuxt 目录结构：https://nuxt.com/docs/4.x/directory-structure/
