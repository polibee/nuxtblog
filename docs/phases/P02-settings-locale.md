# P02 Settings + Locale Registry

## 1. 基本信息

~~~text
Phase ID: P02
Phase Name: Settings + Locale Registry
Owner: polibee
NuxtAdmin Base Commit: a48695f
Depends On: P00
Target Version: v0.1.0-p02
Status: COMPLETE
~~~

## 2. 目标与非目标

### 2.1 目标

- settings 表真实化：基座 Settings 管理页（分组表单/公开标记/密钥掩码/新增/删除）全部改为读写 MySQL，接口形状与基座 UI 完全兼容（静态目录接管 /api/admin/settings）。
- localized_settings 表：按 Locale 覆盖公开设置值（首个消费键 SITE_DESCRIPTION），公开端点支持 ?locale= 并按 Locale 作用域缓存。
- 全部演示 settings 读取方迁移到 DB 服务：mail.ts、mail/config、public-settings、rss.xml、sitemap.xml、pageCache 开关、settingsStore、runtimeConfig（env 优先不变）。
- 公开页消费站点设置：useSiteSettings 组合式；布局站点名、首页 meta description、全局 titleTemplate 换品牌（关闭 P00 follow-up "· Nuxt Admin"）。
- Locale Registry 管理：后台「语言注册表」资源（CRUD、默认语言唯一、content/ui 依赖 enabled、默认语言禁删/禁停用），写入即失效 resolveLocale 缓存与页面缓存；新增 Locale 无需任何 schema 改动（已实测 en）。
- 公开布局宽度优化：内容列 flex-1 撑满、侧边栏固定 w-80 右移，容器 max-w-7xl，窄屏单列堆叠。

### 2.2 非目标

- 不做 localized_settings 的管理界面（表/服务/公开消费已就绪，编辑界面随 P04/P05 内容编辑一起做）。
- 不激活多语言路由/hreflang（P20）；en 仅作为注册表演示数据（urlPrefix 预留）。
- 不做邮件发送验证（SMTP 凭据需真实服务器）。

## 3. NuxtAdmin 接入点

~~~text
Module: app/modules/locales（LocaleResource，permissionPrefix: locales）
Resource: settings（基座 SettingResource/分组页复用，仅数据源切换）、locales（新增）
Server API: /api/admin/settings CRUD（静态目录接管）、/api/admin/locales CRUD（静态目录接管）、
            /api/public-settings（改为 DB + locale 感知，路径与响应形状保持兼容）
Server Service: server/modules/settings/settings.service.ts、server/modules/locales/locale.service.ts
Server Repository: schema/settings.ts、locale.repository.ts（新增写操作）
Server Utils: runtimeConfig/pageCache/settingsStore/mail 全部异步化接 DB settings
Permissions: settings.*（基座既有）、locales.view/create/edit/delete（仅 admin '*'
             与演示 editor 映射不含，注册表默认管理员专属）
~~~

## 4. 数据模型

### 4.1 Entity

~~~text
Table: settings
Fields: id, key varchar(80), value mediumtext, type varchar(20)(string|text|number|boolean|secret|json),
        group varchar(40), is_public boolean, description varchar(255) nullable,
        sort_order bigint, created_at, updated_at
Indexes: UNIQUE(key), INDEX(group)
Table: localized_settings
Fields: id, key varchar(80), locale_id FK locales CASCADE, value mediumtext, updated_at
Indexes: UNIQUE(key, locale_id), INDEX(locale_id)
~~~

### 4.2 Translation

不适用：settings 为机器键值；自然语言值走 localized_settings（按 Locale 覆盖，不是 Entity+Translation 模型，架构文档 §9.3 如此定义）。

### 4.4 Migration

~~~text
Migration: 0004_settings_tables.sql
Seed: seedDefaultSettings() 幂等写入 9 个基线键（SITE_NAME/SITE_URL/SITE_DESCRIPTION/
      MAINTENANCE_MODE/POSTS_PER_PAGE/SMTP_HOST/SMTP_PASSWORD/CACHE_DRIVER/PAGE_CACHE_ENABLED）；
      seedLocalizedSettings() 为默认 Locale 写入 SITE_DESCRIPTION 中文覆盖
Rollback: DROP 两表
~~~

## 5. Repository 与 Service

- settings.service：60s 模块缓存 + 写失效；coerceSettingValue 按类型解析（单测覆盖）；publicSettingsMap 过滤 secret；localized 读/写/删；upsert onDuplicateKeyUpdate。
- locale.service：zod strict 校验；code/urlPrefix 唯一 409；content/ui⇒enabled 422；默认语言禁删/禁停用/禁失联（409），isDefault 转移先 clearDefaultFlags；保底「至少一个内容语言」；ER_DUP_ENTRY→409（default_flag→"仅一个默认"）；每次写失效 resolveLocale 缓存并全量清页面缓存（键已 locale 化）。
- runtimeConfig：readDbConfig/readCacheConfig/buildConnectionString 异步化，env → DB settings 兜底（blog-db 插件按字母序先于 storage 插件完成初始化，顺序安全）。

## 6. Resource / Widget

LocaleResource：code/name/nativeName/urlPrefix/enabled/contentEnabled/uiEnabled/isDefault/sortOrder；表列含四个状态徽标；表单含帮助文案（BCP-47、前缀留空=默认语言）。

## 7. Route 与 API

~~~text
GET/POST /api/admin/settings      settings.view/create
PUT/DELETE /api/admin/settings/:id settings.edit/delete（PUT/POST/DELETE 后清页面缓存）
GET/POST /api/admin/locales       locales.view/create
PUT/DELETE /api/admin/locales/:id locales.edit/delete
GET /api/public-settings[?locale=]  公开，仅 public 非 secret；Cache-Control 60s + 页面缓存 600s（键含 locale）
~~~

Server 检查：显式 import ✓ / Handler 无 SQL ✓ / 经 Service ✓ / Server 权限 ✓ / 错误统一映射 ✓。

## 8. Analytics

不适用。

## 9. 权限矩阵

| 操作 | 未登录 | Viewer | Editor | Admin |
|---|---:|---:|---:|---:|
| 读公开设置 | ✅ | ✅ | ✅ | ✅ |
| 设置管理 | ❌ 401 | ❌ | ❌* | ✅ |
| 语言注册表管理 | ❌ 401 | ❌ | ❌* | ✅ |

*editor 权限映射不含 settings.create/delete 与 locales.*；storage 面板等沿用基座 settings.edit。

## 10. 多语言检查

[x] 新增 Locale 零 schema 改动（实测创建 en）  [x] resolveLocale 缓存写后失效（公开 locales 立刻可见）  [x] 页面缓存键含 locale  [x] 默认语言唯一由生成列唯一键兜底  [x] 公开 locale 覆盖值仅作用于已公开键

## 11. 测试计划

- Unit：coerceSettingValue（boolean/number/text/json/secret）；page-cache 测试适配异步快照与 env 开关。
- Integration（实测）：settings 种子→公开端点→写读回环（含缓存清除）；locale 创建/重复 409/删除默认 409/默认转移/恢复；?locale= 覆盖。

## 12. 验收标准（节选）

~~~text
Given 全新库
When Nitro 启动
Then settings/localized_settings 自动迁移并种子 9 个基线键与 zh-CN 描述

Given 管理员修改 SITE_NAME
When 保存后立刻请求 /api/public-settings
Then 返回新值（页面缓存已清除，无 10 分钟陈旧窗口）

Given 注册表已有默认 zh-CN
When 新建 en 且设为默认
Then zh-CN 失去默认、en 成为唯一默认；删除 zh-CN 前 en 默认时允许，zh-CN 为默认时 409
~~~

## 13. 质量闸门

~~~text
npm run lint      → PASS
npm run typecheck → PASS
npm test          → PASS（108 tests / 16 files）
npm run build     → PASS
浏览器/集成       → 设置分组页(DB)、语言注册表页、公开端点、locale 感知 title、宽屏两栏（530px 视口验证堆叠）
~~~

## 14. 发布、监控与回滚

~~~text
Migration 顺序: 0004（追加）
回滚方式: DROP 两表；runtimeConfig/pageCache 等已异步化，需随代码一起回滚
注意: 本机多次 TaskStop 后 node 子进程可能残留占用 dev 端口，重启前先清理 3000-3002
~~~

## 15. 完成记录

~~~text
Phase Status: COMPLETE
Acceptance: PASS
Known Issues:
  - localized_settings 管理界面未实现（表/服务/公开消费已就绪）
  - runtimeConfig 的 DATABASE_URL/DB_PASSWORD 等存储面板键仍由 env 优先，
    面板写入 DB 后对 readDbConfig 生效；Redis/存储驱动的生产化属 P19
Follow-up: P03 Media；localized 设置编辑界面随内容编辑页实现
~~~
