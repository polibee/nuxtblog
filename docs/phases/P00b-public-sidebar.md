# P00b Public Sidebar Cards + Two-column Layout

## 1. 基本信息

~~~text
Phase ID: P00b
Phase Name: Public Sidebar Cards + Two-column Layout
Owner: polibee
NuxtAdmin Base Commit: a48695f
Depends On: P00
Target Version: v0.1.0-p00b
Status: COMPLETE
~~~

## 2. 目标与非目标

### 2.1 目标

- 公开前台两栏布局：内容列弹性撑满（flex-1），侧边栏固定宽度（w-80）紧贴内容右侧；窄屏单列堆叠。
- 侧边栏卡片完全由后台控制：后台「侧边栏卡片」资源提供增删改查、启用开关、排序值；公开侧边栏按 sortOrder 渲染启用卡片。
- 卡片采用 Entity + Translation 模型（sidebar_cards + sidebar_card_translations），后台编辑用 P00 的 LocalizedField，公开读取严格按请求 Locale、不跨语言 fallback。
- LocalizedField 获得首个消费方，闭环 P00 follow-up（浏览器级验证）。

### 2.2 非目标

- 不做卡片类型扩展（仅 html，枚举可扩展）、不做侧边栏位置/每页独立配置。
- 不实现 Widgets/菜单驱动的动态卡（Navigation 属 P06）。

## 3. NuxtAdmin 接入点

~~~text
Module: app/modules/sidebar（defineResource：sidebar-cards）
Resource: SidebarCardResource（permissionPrefix: sidebar-cards）
Widget: 无
Custom admin page: 无（标准 ResourceList/Form/View）
Server API: /api/admin/sidebar-cards CRUD（静态目录，接管该资源名；未遮蔽任何演示资源名）
Server Service: server/modules/sidebar/sidebar-card.service.ts
Server Repository: server/repositories/sidebar-card.repository.ts、schema/sidebar-cards.ts
Event hooks: 无
Permissions: sidebar-cards.view/create/edit/delete（editor 角色映射已含）
~~~

复用说明：资源名 `sidebar-cards` 在演示 Registry 中不存在，静态目录接管不会遮蔽既有资源；与 P04 起 Posts/Pages 的接管方式一致。

## 4. 数据模型

### 4.1 Entity

~~~text
Table: sidebar_cards
Fields: id, type varchar(32) default 'html', enabled boolean default true,
        sort_order int default 0, created_at, updated_at
Foreign keys: 无
Indexes: INDEX(enabled), INDEX(sort_order)
Unique constraints: 无
Delete strategy: 硬删除（翻译行级联删除）
~~~

### 4.2 Translation

~~~text
Table: sidebar_card_translations
Entity FK: card_id -> sidebar_cards.id ON DELETE CASCADE
Locale FK: locale_id -> locales.id ON DELETE CASCADE
Primary Locale rule: 至少一条 Translation（不限 Locale）；公开读取无 fallback
Required fields: title(1-200), content(min 1，sanitize-html 白名单清洗)
Unique constraints: UNIQUE(card_id, locale_id)
Indexes: INDEX(locale_id)
Public completeness rule: 该 Locale 缺 Translation 的卡片不出现在公开侧边栏
~~~

### 4.3 Analytics / 4.4 Migration

~~~text
Migration: 0002_sidebar_cards.sql（drizzle-kit 生成）
Rollback: DROP TABLE sidebar_card_translations, sidebar_cards
~~~

## 5. Repository 与 Service

- Repository：listCards / findCard / insertCard / updateCard / deleteCard；写路径单事务拆分 Entity+Translation。
- Service：zod 校验（shared/schemas/sidebar-card）、locale code→id 映射、sanitize-html 清洗（写侧+公开读侧双保险）、默认 Locale 预览标题、搜索/分页、ensureDefaultSidebarCard 幂等种子。

## 6. Resource / Widget

~~~text
defineResource({ name: 'sidebar-cards', permissionPrefix: 'sidebar-cards', searchable: ['title'] })
form: type select + sortOrder number + enabled switch + localizedInput(translations, [title, richtext content])
~~~

公开侧边栏组件 app/components/public/SidebarCards.vue：useFetch /api/public/sidebar，Loading 骨架、Empty/Error 渲染为空（不阻断页面）。

## 7. Route 与 API

~~~text
GET    /api/admin/sidebar-cards   sidebar-cards.view    q/page/perPage → Paginated
POST   /api/admin/sidebar-cards   sidebar-cards.create  422 校验 / 未知 locale 422
GET    /api/admin/sidebar-cards/:id  sidebar-cards.view
PUT    /api/admin/sidebar-cards/:id  sidebar-cards.edit   局部更新（translations 整组替换）
DELETE /api/admin/sidebar-cards/:id  sidebar-cards.delete
GET    /api/public/sidebar        无需登录，resolveLocale + 白名单输出（id/type/title/content/sortOrder）
~~~

Server 检查：显式 import ✓ / Handler 无 SQL ✓ / 经 Service ✓ / Server 权限 ✓ / 401/404/422 统一映射 ✓。

## 8. Analytics

不适用。

## 9. 权限矩阵

| 操作 | 未登录 | Viewer | Editor | Admin |
|---|---:|---:|---:|---:|
| 查看公开侧边栏 | ✅ | ✅ | ✅ | ✅ |
| 管理（后台 CRUD） | ❌ 401 | ❌ 403 | ✅ | ✅ |

实测：未登录 POST /api/admin/sidebar-cards → 401。

## 10. 多语言检查

[x] 自然语言字段进 Translation 表  [x] UNIQUE(entity, locale)  [x] 公开无跨语言 fallback  [x] Cache Key 规则待接入（公开端点当前直读，P04 起套 withLocaleKey）

## 11. 测试计划

- Unit：sidebar-card input schema（至少一条翻译、未知类型/多余键拒绝）；复用 locale/translation 基线。
- Integration：API 实测 create/update/sanitize/401/公开输出。
- E2E：浏览器验证两栏渲染、后台列表/表单（LocalizedField Tabs + 完整度徽标 + 富文本）、公开卡片渲染。

## 12. 验收标准（节选）

~~~text
Given 后台创建一张启用卡片（zh-CN 标题+正文）
When 公开首页以 zh-CN 渲染
Then 卡片出现在侧边栏且 script 等被白名单清洗

Given 卡片未提供当前 Locale 的翻译
When 公开渲染
Then 该卡片不出现（不回退其他语言）

Given 未登录调用管理端点
When POST /api/admin/sidebar-cards
Then 401
~~~

## 13. 质量闸门

~~~text
npm run lint      → PASS
npm run typecheck → PASS
npm test          → PASS（105 tests / 15 files）
npm run build     → PASS
浏览器            → 两栏布局、后台列表/创建表单、公开卡片均验证（快照）
~~~

## 14. 发布、监控与回滚

~~~text
Migration 顺序: 0002（追加）
环境变量: 无新增
回滚方式: DROP 两表 + 移除模块/端点
~~~

## 15. 完成记录

~~~text
Phase Status: COMPLETE
Acceptance: PASS
Known Issues: NONE
Follow-up: 卡片类型扩展（links/profile）按需演进；侧边栏缓存接入 P04
~~~
