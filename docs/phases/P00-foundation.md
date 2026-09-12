# P00 Foundation + NuxtAdmin Integration

## 1. 基本信息

~~~text
Phase ID: P00
Phase Name: Foundation + NuxtAdmin Integration
Owner: polibee
NuxtAdmin Base Commit: a48695f（当前仓库即基座，HEAD 锁定于此）
Depends On: NONE
Target Version: v0.1.0-p00
Status: COMPLETE
~~~

## 2. 目标与非目标

### 2.1 目标

- 建立博客框架的独立数据层：MySQL 8.x + Drizzle ORM 的真实 Repository 抽象，与基座演示内存 db（server/utils/db.ts）完全隔离。
- 建立 Migration 基础设施（drizzle-kit 生成 SQL + Nitro 启动时自动迁移），首个迁移创建 `locales` 表并 Seed zh-CN。
- 建立 Locale 基础设施：`shared` 类型/Zod Schema、`resolveLocale` 服务端解析、locale repository、公开 locales 端点、客户端 useLocale 与全局 middleware。
- 提供公开前台 Layout（app/layouts/public.vue）与公开首页骨架，`/` 不再 302 到 /admin。
- 实现 NuxtAdmin 通用扩展 LocalizedField（LocaleTabs / TranslationStatus / MissingTranslationBadge），输入结构 `translations[locale][field]`，不写死 Posts（见 ADR-0001）。
- 建立测试基线：locale 解析、Locale Schema、Translation 完整度单测。

### 2.2 非目标

- 不实现用户/认证（P01）、Settings（P02）、任何内容 Entity 表（P04+）。
- 不做第二语言的 UI i18n 或多语言路由激活（P20）。
- 不改动基座演示模块（orders/menus/ct_* 等）的数据通路。
- 不引入 Analytics（P09）与商业化模型（P10-P13）。

## 3. NuxtAdmin 接入点

~~~text
Module: 无新增业务 Module（LocalizedField 为框架扩展而非 Resource）
Resource: 无（Locale Registry 管理界面属 P02）
Widget: 无
Custom admin page: 无
Server API: GET /api/public/locales（公开，只读，无敏感数据）
Server Service: server/utils/locale.ts（locale 解析与缓存键规则）
Server Repository: server/repositories/db.server.ts、locale.repository.ts、schema/locales.ts
Event hooks: 无（后续 Phase 内容保存时通过事件失效 locale 相关缓存）
Permissions: 无新增（公开只读端点不需要 RBAC）
~~~

修改 app/admin/core/types.ts 与 app/admin/framework/FormField.vue 新增 `localized` 字段类型，附 ADR-0001。

## 4. 数据模型

### 4.1 Entity

~~~text
Table: locales
Fields: id (bigint unsigned PK auto_increment), code varchar(20), name varchar(80),
        native_name varchar(80), url_prefix varchar(20) nullable,
        enabled boolean default true, content_enabled boolean default false,
        ui_enabled boolean default false, is_default boolean default false,
        fallback_locale_id bigint unsigned nullable, sort_order int default 0,
        created_at datetime(6), updated_at datetime(6)
Foreign keys: fallback_locale_id -> locales.id (ON DELETE SET NULL)
Indexes: UNIQUE(code), UNIQUE(url_prefix), INDEX(enabled)
Unique constraints: 见上；"最多一个 is_default=true" 由生成列 default_flag + UNIQUE 实现
Delete strategy: 软删除不适用于 Locale Registry；禁删 is_default 行由 Service 保证（P02）
~~~

### 4.2 Translation

不适用。P00 无自然语言内容 Entity，locales 表自身为注册表（机器字段 + 展示名），展示名不随 UI 语言翻译。首个 Translation 表（post_translations）在 P04 引入。

### 4.3 Analytics

不适用（P09）。

### 4.4 Migration

~~~text
Migration name: 0000_parallel_magneto（drizzle-kit 生成，含 locales 表）
Forward migration: CREATE TABLE locales + 索引 + 生成列唯一约束
Seed/data migration: 由 db.server.ts ensureLocaleSeed() 执行（code=zh-CN, url_prefix="",
  enabled/content_enabled/ui_enabled/is_default=true），幂等
Backward migration: DROP TABLE locales（回滚脚本不自动执行）
Rollback limitation: 已写入的 Locale 行会随 DROP 丢失
Backup requirement: 开发阶段无；生产前纳入 Backup Manifest（§15）
~~~

## 5. Repository 与 Service

### 5.1 Repository

~~~text
db.server.ts:      ensureDatabase() / migrate() / getDb()（显式 import 单例）
locale.repository.ts:
  listLocales({ enabledOnly? })
  findByCode(code)
  getDefaultLocale()
  withTransaction(fn)   // P00 预留事务句柄
~~~

Repository 不处理 HTTP、Vue 和页面文案。

### 5.2 Service

server/utils/locale.ts：

- `resolveLocale(event)`：解析顺序 URL 前缀 → Accept-Language 中已启用 Locale → 默认 Locale；开发阶段仅默认 Locale 无前缀，命中规则随 locales 表数据生效。
- 返回 `{ id, code, url_prefix }`；DB 不可用时降级为常量默认 zh-CN，不阻断请求。
- `translationCompleteness(...)`（shared）：Missing / Incomplete / Complete 判定，primary locale 完整才可发布（供 P04 使用，P00 先建规则与测试）。
- 公开内容查询显式接收 locale；缓存键规则 `page:{locale}:{path}` 等以 locale 开头。

## 6. Resource / Widget

不适用（无新 Resource/Widget）。LocalizedField 扩展供后续 Phase 的 Resource form 使用：

~~~text
defineResource({ ..., form: () => [localizedInput('translations', '内容', { subFields: [...] })] })
值结构: { [localeCode]: { [field]: value } }
~~~

## 7. Route 与 API

~~~text
Nuxt page: app/pages/index.vue（公开首页骨架，layout: public）
Layout: app/layouts/public.vue
Middleware: app/middleware/locale.global.ts（解析当前 locale 写入全局状态）
SEO Meta: 首页 title/description 占位，canonical 随 P04

Method: GET
Path: /api/public/locales
Auth: 无（公开注册表，无敏感字段）
Permission: 无
Input Schema: 无
Output Schema: { locales: [{ code, name, native_name, url_prefix, is_default, content_enabled }] }
Errors: 500 统一映射
Rate limit: 无（只读且可缓存）
Cache: 内存 60s TTL（模块级），写操作（P02）时失效
~~~

Server 检查：

~~~text
[x] server/utils/* 跨文件显式 import
[x] Handler 不写复杂 SQL
[x] Handler 不绕过 Service（locale 读取经 repository）
[x] Server 再次执行权限（公开端点无需权限，字段白名单输出）
[x] 错误统一映射
~~~

## 8. Analytics 专用章节

不适用（P09）。

## 9. 权限矩阵

| 操作 | 未登录 | Viewer | Editor | Admin | 备注 |
|---|---:|---:|---:|---:|---|
| 查看公开内容（首页） | ✅ | ✅ | ✅ | ✅ | 公开页面 |
| GET /api/public/locales | ✅ | ✅ | ✅ | ✅ | 白名单字段 |
| 后台（/admin/**） | ❌ 401 | ✅ | ✅ | ✅ | 基座行为不变 |

测试：未登录访问 /admin 跳转登录；公开端点未登录可访问；后台 API 未登录 401（既有行为回归）。

## 10. 多语言检查

~~~text
[x] P00 无自然语言字段（locales 展示名不翻译，理由见 4.2）
[x] 不写死 Locale：默认 Locale 取 locales.is_default，降级常量仅用于 DB 不可用
[x] Missing/Incomplete/Complete 规则已在 shared/schemas/locale.ts 建立
[x] Cache Key 包含 Locale（规则定义于 server/utils/locale.ts）
[x] 新增 Locale 不需要 Schema 改动（locales 为数据行）
[x] UI Locale 与 Content Locale 独立（content_enabled/ui_enabled 分列）
~~~

## 11. 测试计划

### Unit

- Locale 前缀解析 / Accept-Language 解析 / 默认降级（tests/unit/locale-resolve.test.ts）
- locales Zod Schema 校验（tests/unit/locale-schema.test.ts）
- Translation 完整度规则（tests/unit/translation-completeness.test.ts）

### Integration

- Migration 执行 + Seed 幂等（手动 + 启动日志验证；MySQL 8.4 本地实例）

### E2E

- P00 引入 Playwright 基线推迟到 P04（首个公开内容页可用时），理由：当前公开面仅静态骨架，E2E 价值低；权限回归由既有手工验证覆盖。

## 12. 验收标准

~~~text
Given 本地 MySQL 8.x 运行且 .env 配置正确
When Nitro 启动
Then 自动创建库/表并幂等 Seed zh-CN，日志输出 [blog-db] ready

Given DB 停止
When Nitro 启动
Then 输出错误日志但不崩溃，公开页面与 /admin 仍可访问（降级）

Given GET /api/public/locales
When 调用
Then 200 返回 zh-CN 且不含敏感字段

Given 管理后台任一 Resource form 使用 localizedInput
When 渲染
Then 出现 Locale Tabs，值结构为 translations[locale][field]
~~~

## 13. 质量闸门

~~~text
npm run lint      → PASS（eslint .，0 错误）
npm run typecheck → PASS（nuxt typecheck，0 错误）
npm test          → PASS（vitest run：12 文件 / 85 测试全过，含 3 个 P00 新增文件）
npm run build     → PASS（nuxt build，.output 12 MB）
~~~

补充验证（实际命令与结果）：

~~~text
dev 启动日志       → [blog-db] ready (mysql://127.0.0.1:3306/nuxtblog)
mysql SHOW CREATE  → locales 表含 UNIQUE(code/url_prefix/default_flag)、
                     FK fallback_locale_id、CHECK(content/ui requires enabled)
约束注入测试       → 二次 is_default 被 default_flag 唯一键拒绝（1062）；
                     content_enabled 无 enabled 被 CHECK 拒绝（3819）
GET /api/public/locales → 200，返回 zh-CN 白名单字段
GET /              → 200，public 布局渲染（浏览器结构化快照验证）
GET /admin         → 302 → /login（基座行为回归正常）
~~~

## 14. 发布、监控与回滚

~~~text
Migration 顺序: P00 仅 locales；后续 Phase 新增迁移追加
Feature Flag: 无（数据层独立于演示模块）
环境变量: BLOG_DB_*（DATABASE_URL / DB_HOST / DB_PORT / DB_NAME / DB_USER / DB_PASSWORD）
日志指标: [blog-db] 启动迁移与连接日志
告警条件: 迁移失败 / 连接失败（日志 ERROR）
回滚方式: 还原迁移目录 + DROP TABLE locales
数据恢复: 开发阶段重建即可
~~~

## 15. 完成记录

~~~text
Phase Status: COMPLETE
Acceptance: PASS
Known Issues: NONE
Breaking Changes Allowed: NO
Follow-up:
  - 公开页 <title> 仍带基座全局后缀 "· Nuxt Admin"（app.vue titleTemplate），
    P02 站点设置上线时统一换品牌。
  - LocalizedField 已编译/类型/lint 通过，浏览器级验证推迟到 P04 首个
    消费方（Posts 编辑页）一并做 E2E。
~~~

变更文件（P00 新增/修改）：

~~~text
docs/phases/P00-foundation.md              本阶段文档
docs/adr/0001-localized-field-form-extension.md  ADR
.env / .env.example / drizzle.config.ts    数据层配置
server/repositories/schema/locales.ts      Drizzle 表定义
server/repositories/migrations/0000_*.sql  建表迁移
server/repositories/migrations/0001_*.sql  FK + CHECK 约束迁移
server/repositories/db.server.ts           连接/迁移/Seed 单例
server/repositories/locale.repository.ts   Locale 仓储
server/utils/locale.ts                     resolveLocale + 解析纯函数
server/api/public/locales.get.ts           公开 Locale 端点
server/plugins/blog-db.ts                  Nitro 启动初始化
shared/types/locale.ts / shared/schemas/locale.ts
app/composables/useLocale.ts / app/middleware/locale.global.ts
app/layouts/public.vue / app/pages/index.vue
app/admin/extensions/localized-field/      LocalizedField / TranslationStatus / MissingTranslationBadge
app/admin/core/types.ts（localized 类型）/ app/admin/framework/FormField.vue（分支）
app/admin/forms/schemaToZod.ts（localized 规则）/ app/admin/schemas/builders/fields.ts（构建器）
app/admin/i18n/index.ts（public.* 与 ext.localized.* 文案）
tests/unit/locale-resolve / locale-schema / translation-completeness.test.ts
package.json（drizzle-orm、drizzle-kit、db:generate 脚本）
~~~
