# P05 Pages

## 1. 基本信息

~~~text
Phase ID: P05
Phase Name: Pages
Owner: polibee
NuxtAdmin Base Commit: a48695f
Depends On: P00, P04
Target Version: v0.1.0-p05
Status: COMPLETE
~~~

## 2. 目标与非目标

### 2.1 目标

- pages + page_translations 真实 DB：与 Posts 相同的 Entity+Translation 事务拆分模式；template 属于 Entity 不翻译；draft/published/archived 生命周期；发布闸门=主语言完整度；slug 每 locale 唯一；content 服务端 sanitize。
- 后台「页面」资源（/api/admin/pages 静态目录接管）：LocalizedField 编辑 title/slug/content/SEO/noindex + 模板选择。
- 公开面：/api/public/pages/:slug 与 /api/public/pages（列表，导航/页脚用）；公开路由 /pages/[slug]；noindex 排除出 sitemap；SEO meta 接入。

### 2.2 非目标

- 不做 [...publicPath] 兜底路由（页面 URL 暂为 /pages/{slug}，主题阶段 P17 可映射任意路径）。
- 不做模板渲染差异（template 字段已就位，落地页模板随 P17 Theme）。
- 不做页面版本/修订。

## 3. NuxtAdmin 接入点

~~~text
Module: app/modules/pages（新增，PageResource）
Resource: pages（permissionPrefix: pages）
Server API: /api/admin/pages 静态目录接管（index.get/post、[id].get/put/delete）；/api/public/pages(.get)、/api/public/pages/:slug
Server Service: server/modules/pages/page.service.ts（含 pageInputSchema/PAGE_STATUSES）
Server Repository: page.repository.ts、schema/pages.ts
Permissions: pages.view/create/edit/delete（editor 映射已含）
~~~

## 4. 数据模型

### 4.1 Entity

~~~text
pages: id, primary_locale_id FK locales, author_id FK users, template varchar(40) default 'default',
       status(draft|published|archived), published_at, deleted_at, created_at, updated_at
       INDEX(status/author)
~~~

### 4.2 Translation

~~~text
page_translations: title/slug/content(mediumtext 无默认)/seo_title/seo_description/canonical_url/noindex
   UNIQUE(page_id, locale_id)；UNIQUE(locale_id, slug)；INDEX(locale_id)
~~~

### 4.4 Migration

~~~text
Migration: 0008_pages_tables.sql
Rollback: DROP 两表
~~~

## 5. Repository 与 Service

- repository：管理端分页/跨语言搜索/状态过滤；findPublishedPageBySlug / listPublishedPages（published + published_at<=now + locale 存在 + noindex 排除）。
- service：pageInputSchema strict；buildTranslationRows（自动 slug、sanitize）；checkStatus 发布闸门；publishedAt 进出 published 维护；AdminPage 附 title 预览。

## 6. Resource / Widget

PageResource：列表（title/模板/状态/时间 + 查看公开 Action）；表单（状态/模板 + LocalizedField 内容区）；infolist。

## 7. Route 与 API

~~~text
GET/POST /api/admin/pages            pages.view/create（POST 注入当前用户为 author）
GET/PUT/DELETE /api/admin/pages/:id  pages.view/edit/delete
GET /api/public/pages?locale         公开（slug+title 列表）
GET /api/public/pages/:slug?locale   公开详情，404 不存在
~~~

Server 检查：显式 import ✓ / Handler 无 SQL ✓ / 经 Service ✓ / Server 权限 ✓ / 错误统一映射 ✓。

## 8. Analytics

不适用（P09）。

## 9. 权限矩阵

| 操作 | 未登录 | Viewer | Editor | Admin |
|---|---:|---:|---:|---:|
| 公开页面读取 | ✅ | ✅ | ✅ | ✅ |
| 页面管理 | ❌ 401 | ❌ | ✅ | ✅ |

## 10. 多语言检查

[x] slug 每 locale 唯一  [x] 发布闸门=主语言完整度  [x] 公开读取无跨语言 fallback（zh/en 双语实测）  [x] template 为 Entity 机器字段不翻译  [x] noindex 排除 sitemap

## 11. 测试计划

- Unit：复用 post-schema 套件（slug/strict 校验同构）。
- Integration（实测）：创建双语页面 → 管理列表 → 公开详情（zh/en）→ sitemap 收录 /pages/about → 修复 listPages 排序 SQL（desc(asc()) 嵌套导致的 ER_PARSE_ERROR）。

## 12. 验收标准（节选）

~~~text
Given 管理员创建双语 published 页面
When 访问 /pages/{slug}
Then 按请求 locale 渲染内容且 SEO meta 正确

Given 页面不存在或为草稿
When 访问对应 slug
Then 404

Given 发布页面
When GET /sitemap.xml
Then 包含 /pages/{slug}（noindex 页面除外）
~~~

## 13. 质量闸门

~~~text
npm run lint      → PASS
npm run typecheck → PASS
npm test          → PASS（122 tests / 18 files）
npm run build     → PASS
集成/浏览器       → 创建双语页面、公开详情、sitemap 收录实测；/pages/about 渲染验证
~~~

## 14. 发布、监控与回滚

~~~text
Migration 顺序: 0008（追加）
回滚方式: DROP 两表 + 移除模块/路由
~~~

## 15. 完成记录

~~~text
Phase Status: COMPLETE
Acceptance: PASS
Known Issues: 页面 URL 固定 /pages/{slug}（[...publicPath] 兜底属 P17 Theme API）
Follow-up: P06 Navigation（页面可被菜单引用）；P17 模板差异化渲染
~~~
