# 多语言、个人主页与 Alias 迁移审计及修复设计

## 1. 目标

本设计用于修复当前 Nuxt Blog 的三组关联问题：

1. 后台 UI 语言包集中在单文件，模块无法独立维护。
2. `/profile` 个人主页只有单语言数据，后台无法按语言维护。
3. 内容 URL、Alias、Translation.slug 仍有混用，Alias 修改缺少完整的 301 迁移和后台提醒。

设计必须兼容现有模块边界，并为后续 MySQL/PostgreSQL/Supabase 仓储切换保留清晰的数据访问接口。

## 2. 审计结论

### P0：必须修复

- `app/admin/i18n/index.ts` 承载全部模块文案，造成模块耦合和冲突风险。
- `app/middleware/locale.global.ts` 只读取 Cookie，尚未实现语言前缀路由。
- `server/modules/profile/profile.service.ts` 和 `server/repositories/schema/profile.ts` 的个人主页内容均为单语言字段。
- `server/api/public/profile.get.ts` 不接收 locale，公开页面无法按语言返回内容。
- `app/modules/posts/admin/PostResource.ts`、`PageResource.ts` 仍读取 `translations[*].slug`，与 Entity alias 设计冲突。
- `app/pages/[slug].vue` 和 Sitemap 仍保留旧 slug 路径逻辑。
- Alias 修改后的重定向没有完整覆盖语言前缀、旧路径链和后台确认提醒。

### P1：应在同一实施周期处理

- `localized_settings` 已有数据层，但没有完整后台编辑界面。
- 页面、文章、分类、标签和个人主页的 URL 构造需要统一使用 route resolver。
- Alias 唯一性、保留路径和不同实体命名空间冲突需要由服务端统一校验。
- 公开页面需要补齐 canonical、alternate/hreflang 和 locale 作用域缓存。
- 所有模块需要禁止新增硬编码用户可见文案，并建立语言 key 完整性测试。

## 3. 设计原则

- UI i18n 与内容本地化分离：UI 文案属于代码语言包，文章、页面、Profile 等属于数据库 Translation。
- Entity alias 与 Translation 内容分离：alias 是稳定公开标识，不随语言改变；Translation 只保存人类可读内容。
- 所有公开 URL 通过同一个 resolver 生成，菜单、Sitemap、RSS、canonical 和语言切换器不得自行拼接。
- Alias 修改是迁移操作，不是普通字段更新：保存旧路径、创建 301、清理缓存并提示管理员。
- 语言缺失采用明确的默认语言回退，并向后台显示翻译缺失状态。
- 服务端校验和权限优先，客户端语言切换与确认只负责体验。
- 数据访问继续经过 repository/service，不在页面或 API handler 内直接操作数据库。

## 4. 模块化 UI 语言包

### 4.1 目录

```text
app/admin/i18n/
├── core/
│   ├── zh-CN.ts
│   └── en-US.ts
├── modules/
│   ├── posts/{zh-CN,en-US}.ts
│   ├── pages/{zh-CN,en-US}.ts
│   ├── profile/{zh-CN,en-US}.ts
│   ├── settings/{zh-CN,en-US}.ts
│   └── ...
└── index.ts
```

`index.ts` 只负责按 locale 合并 core 与已注册模块；模块文件只能声明本模块的 key。相同 key 冲突必须在测试中失败，而不是后加载覆盖。

### 4.2 运行规则

- Translator API 保持现有调用方式，降低模块迁移成本。
- 缺少模块 key 时按当前 locale → 默认 locale → key 本身回退。
- 模块注册由模块自身完成，新增模块必须同时提供默认语言包和至少一套测试语言包。
- 用户可见文本、错误提示、空状态、按钮、表单帮助文案均禁止新增硬编码。
- 语言完整性测试检查 key 集合、重复 key 和插值参数一致性。

## 5. Locale 路由与内容本地化

### 5.1 URL 规则

```text
/profile
/en/profile
/posts/react-router
/en/posts/react-router
/pages/about
/en/pages/about
```

默认语言可以不带前缀，非默认语言必须使用 `urlPrefix`。middleware 负责解析路径前缀，resolver 负责从注册表校验 enabled/contentEnabled。

### 5.2 文章语言发布规则

文章采用“实体状态 + 翻译状态”双层模型：

- `posts.status` 控制文章实体是否允许公开。
- `post_translations` 的每条语言记录增加 `status`（draft/published）和可选 `publishedAt`。
- 后台编辑器按 Locale Tab 编辑标题、摘要、正文和 SEO；保存某个语言不会覆盖其他语言。
- 只有 `posts.status = published` 且当前请求 locale 的 translation `status = published` 时，文章才出现在列表、详情、RSS 和 Sitemap。
- 中文翻译只出现在中文 locale；英文翻译只出现在英文 locale。默认不把中文文章复制到英文页面，也不把缺失翻译伪装成另一种语言。
- 语言切换器只在目标 locale 存在已发布 translation 时显示可访问链接，否则显示不可用状态或回到语言首页。
- 翻译缺失时后台显示“未翻译/草稿/已发布”，公开端点返回 404 或从产品配置允许的默认语言回退；文章列表默认禁止跨语言回退，避免语言内容混杂。
- 发布文章时必须至少有主语言的完整已发布 translation；发布其他语言需要单独审核和发布。

文章列表查询必须显式带 `localeId`，并在 SQL 层 join 当前 locale 的已发布 translation，而不是先查询所有文章再由前端过滤。

### 5.3 Profile 数据模型

保留非语言实体表保存排序、开关、URL、媒体引用和状态；把自然语言字段迁移到 Translation 表：

```text
author_profile
author_profile_translations
author_experiences
author_experience_translations
author_projects
author_project_translations
author_education
author_education_translations
author_certifications
author_certification_translations
author_focus_items
author_focus_item_translations
```

个人资料、经历、项目、教育、证书和 Focus 的显示文本按 locale 查询。社交平台 URL、平台类型、排序和 showIn* 开关保持实体级数据。

### 5.4 服务接口

```text
getProfileBundle(locale?)
saveProfileBundle(bundle, locale)
getPublicProfile({ locale })
getProfileTranslationStatus()
```

公开读取顺序为请求语言 → 默认语言；后台编辑器按语言切换，显示缺失/继承/已翻译状态。保存必须在一个事务中完成，并在成功后清理 Profile、SEO、页面和导航缓存。

## 6. Alias、可配置 URL 与 301

### 6.0 编辑器中的 Alias 设计结论

当前 Alias 方向基本正确，但编辑器实现需要调整：

- Alias 必须是文章实体级字段，所有语言共享一个 Alias；不能在中文/英文 Translation Tab 中各填一个 Alias。
- Alias 适合作为稳定 URL 标识，不适合作为文章标题的实时自动翻译结果。
- 新建文章可以根据主语言标题生成建议值，但必须允许管理员修改；中文标题无法可靠生成英文 Alias 时应提示管理员填写英文小写短横线，而不是生成时间戳作为最终 SEO URL。
- 已发布文章修改 Alias 必须显示旧 URL、新 URL 和 301 提醒并二次确认；草稿修改不创建公开 redirect，发布后首次变更才创建。
- Alias 校验规则为小写英文字母、数字和短横线；唯一性按实体类型/公开路由命名空间检查，并拒绝 `admin`、`api`、`posts`、`pages`、`profile` 等保留路径。
- 编辑器的“查看公开文章”按钮必须读取 `record.alias` 并使用当前已发布语言生成 URL，不得读取 `translations[*].slug`。

### 6.1 统一 resolver

```text
contentUrl(entityType, alias, locale)
resolveContentRoute(path)
```

所有 Entity 使用主表 alias；禁止新代码读取或写入 `Translation.slug`。旧 slug 仅作为一次性迁移兼容数据，不得继续扩展旧接口。

### 6.2 Alias 更新事务

1. 校验 alias 格式、保留路径和实体内唯一性。
2. 读取当前语言及默认语言的完整旧路径。
3. 更新 Entity.alias。
4. 为每个受影响语言写入 `url_redirects`，默认状态码 301。
5. 清理旧路径、新路径、内容、导航、Sitemap、RSS 和 SEO 缓存。
6. 发布内容的 Alias 修改必须要求管理员确认，并在表单中明确展示旧 URL、新 URL 和 301 说明。

重定向 middleware 只对 GET/HEAD 生效，禁止 `/admin` 和 `/api` 路径参与公开重定向；旧路径不能继续渲染旧内容。重定向链应压缩到最终地址，避免 A→B→C 的长期链路。

### 6.3 Profile URL

Profile 的公开路径使用站点设置或 Profile 专用 alias 配置，默认 `/profile`。修改后按语言生成旧路径到新路径的 301，并提供“查看旧地址/新地址”的后台提醒。

## 7. localized settings 后台维护

新增设置编辑器的 locale 维度：

- 普通系统设置仍维护在 `settings`。
- 可公开的自然语言设置通过 `localized_settings` 按 locale 编辑。
- secret 类型禁止写入 localized_settings。
- 保存后立即清除带 locale 的 public-settings、页面和 SEO 缓存。
- 缺少翻译时显示继承默认语言，而不是把数据库空值误认为已翻译。

## 8. 验证计划

### 单元测试

- 语言包合并、重复 key、插值参数和缺失回退。
- locale 前缀解析、默认语言、省略前缀和禁用语言。
- Profile Translation 的保存、回退和缺失状态。
- Alias 校验、保留路径、唯一冲突、旧路径生成和重定向链压缩。

### 接口测试

- `GET /api/public/profile?locale=zh-CN/en-US` 返回对应语言。
- Profile 后台按语言保存后公开端点立即返回新内容。
- Alias 修改后旧 URL 返回 301，新 URL返回 200。
- 不同语言旧 URL 均能跳转到对应语言的新 URL。
- localized settings 保存后按 locale 生效并清除缓存。

### 浏览器验收

- 后台语言切换后模块导航、表单、空态和错误信息完整翻译。
- Profile 后台语言 Tab 可以编辑、预览并显示翻译完成度。
- `/profile`、`/en/profile` 页面内容、标题、canonical 和语言切换正确。
- Alias 修改弹出明确的 301 提醒，保存后旧链接可访问并跳转。

## 9. 实施顺序

1. 模块化 UI i18n 和完整性测试。
2. 统一 locale resolver 与公开语言路由。
3. Profile Translation 表、仓储、服务和后台编辑器。
4. Alias/slug 清理、统一 URL resolver 和 301 流程。
5. localized settings 后台维护。
6. Sitemap、RSS、导航、canonical、缓存和浏览器验收。

## 10. ORM 数据库兼容优化方案

### 10.1 目标与现状

当前 `server/repositories/db.server.ts` 直接创建 `mysql2` 连接池并固定使用 `drizzle-orm/mysql2`，schema 目录也普遍使用 `mysqlTable` 和 MySQL 方言。`server/utils/store.ts` 虽然已经支持 PostgreSQL/Supabase，但它只覆盖通用 `cms_records`，不能替代博客领域仓储。

目标是让业务模块只依赖 ORM Repository Contract，不直接依赖 `mysql2`、`pg`、连接池、原生 SQL 或具体方言。数据库切换只改变启动配置、ORM driver、schema/migration bundle 和少量 dialect capability，不改变业务 service、API 和页面。

### 10.2 分层结构

```text
业务模块 / API handler
        ↓
Domain service
        ↓
Repository contract（按领域定义接口）
        ↓
Drizzle repository implementation
        ↓
Database adapter（mysql / postgres / supabase）
        ↓
连接池与事务管理
```

建议目录：

```text
server/database/
├── config.ts                 # 读取、校验、脱敏数据库配置
├── types.ts                  # DatabaseClient、Transaction、DatabaseDriver
├── factory.ts                # 根据 driver 创建 ORM client
├── lifecycle.ts              # 初始化、迁移、健康检查、关闭
├── capabilities.ts           # dialect 能力，不允许业务自行判断 driver
├── schema/
│   ├── mysql/
│   └── postgres/
└── migrations/
    ├── mysql/
    └── postgres/

server/repositories/
├── contracts/                # PostRepository、PageRepository 等接口
├── drizzle/
│   ├── mysql/
│   └── postgres/
└── index.ts                  # 只导出当前 driver 对应实现
```

### 10.3 ORM 约束

- 统一使用 Drizzle ORM 的类型化 query builder；业务代码禁止导入 `mysql2/promise`、`pg`、`drizzle-orm/mysql2`、`drizzle-orm/node-postgres`。
- 连接池只能在 `server/database/factory.ts` 创建；禁止 repository 自行创建连接。
- Repository 接收结构化参数并返回领域类型，不返回 ORM 原始 row，避免 schema 泄漏到 service。
- 所有写操作通过 Repository 的事务上下文执行；跨表写入必须由 service 开启事务并传递 `TransactionContext`。
- `sql` tagged template 只允许出现在 database/repository adapter 内，必须使用参数绑定；禁止 `sql.raw` 拼接用户输入。
- 数据库 driver 判断只能出现在 factory、migration runner 和 capability registry；业务逻辑使用能力接口，例如 `supportsReturning`、`supportsJson`、`supportsFullTextSearch`。
- 日期、布尔、JSON、金额、分页和唯一冲突必须在 Repository 层归一化，service 不写数据库方言分支。
- Supabase 使用 PostgreSQL ORM adapter；前端只能使用 publishable/anon key，service role 只允许在服务端运行时配置，不能进入客户端 bundle。

### 10.4 连接配置

统一配置为：

```text
DB_DRIVER=memory|mysql|postgres|supabase
DATABASE_URL=...
DB_SSL=true|false
DB_POOL_MAX=10
DB_CONNECT_TIMEOUT_MS=5000
DB_QUERY_TIMEOUT_MS=10000
ALLOW_MEMORY_FALLBACK=false
```

- `supabase` 是 PostgreSQL 的部署/连接预设，不新增一套业务数据模型。
- 优先使用 `DATABASE_URL`；离散 host/port/user/password 仅作为兼容配置。
- 启用 Supabase 时默认 SSL，连接串不得写入日志；日志只输出 driver、host 脱敏信息和 schema version。
- 生产和测试默认禁止数据库失败后回退内存；内存模式必须通过 `DB_DRIVER=memory` 显式选择。
- 应用启动顺序固定为：读取配置 → 创建 ORM client → 校验连接 → 执行对应 migration bundle → 注册 repositories → 启动业务插件。
- migration 或健康检查失败时标记应用 degraded/启动失败，不能让部分业务写入内存、部分业务写入远程数据库。

### 10.5 Schema 与迁移策略

- 业务 schema 使用 Drizzle schema 定义；MySQL 与 PostgreSQL 使用各自目录，公共字段和关系保持同一领域模型。
- 不把 MySQL migration 直接交给 PostgreSQL/Supabase 执行，也不通过字符串替换伪造跨数据库迁移。
- 每个 migration bundle 必须可重复执行、可审查，并在 CI 中针对对应 dialect 生成 SQL diff。
- 新增表、字段、索引、唯一约束和外键必须先更新 schema，再生成 migration，再执行回读验证。
- 迁移必须包含数据兼容步骤：旧 `slug` 到 Entity `alias`、Profile 单语言字段到 Translation 表、默认 Locale 初始化和旧 URL redirect 导入。
- Supabase migration 需要检查 RLS、Data API 暴露权限、索引和事务行为；公开表默认开启 RLS，并按实际访问模型创建 policy。
- `drizzle.config.ts` 不再硬编码 `dialect: 'mysql'`；根据 `DB_DRIVER` 选择 schema、dialect、迁移输出目录，未知 driver 直接失败。

### 10.6 Repository Contract 示例

```ts
export interface PageRepository {
  findById(id: number, tx?: TransactionContext): Promise<Page | null>
  findPublishedByAlias(input: { localeId: number, alias: string }): Promise<PublicPage | null>
  list(query: PageListQuery): Promise<Paginated<Page>>
  create(input: CreatePageInput, tx: TransactionContext): Promise<Page>
  update(id: number, input: UpdatePageInput, tx: TransactionContext): Promise<Page>
}
```

`PageService`、`ProfileService`、`PostService` 只依赖这些接口。`DrizzleMySqlPageRepository` 和 `DrizzlePostgresPageRepository` 实现相同 contract，切换 driver 时由 factory 注入，不允许在 service 中出现 `if (driver === 'mysql')`。

### 10.7 测试与切换验收

- Contract tests：同一套 Repository contract 测试分别运行 MySQL 和 PostgreSQL/Supabase adapter。
- Migration tests：空库、旧库升级、重复执行、回滚/恢复和数据数量校验。
- Transaction tests：跨表保存全部成功或全部回滚，不能留下半套 Profile Translation。
- Compatibility tests：分页、排序、null、布尔、JSON、唯一冲突、日期时区、LIKE/全文搜索和金额精度。
- Health tests：错误连接不会启动半可用数据层，memory 只有显式 driver 才会启用。
- 切换验收：停止应用 → 修改 `DB_DRIVER` 和 `DATABASE_URL` → 执行目标迁移 → 启动 → contract/API/E2E 通过；业务代码和页面代码不得修改。

### 10.8 分阶段落地

1. 抽出 `server/database` factory、config、lifecycle 和 transaction context，先保持 MySQL 行为不变。
2. 把现有 repositories 改为 contract + Drizzle MySQL implementation，移除业务层对 `getDb()` 的直接依赖。
3. 将 schema 中的 MySQL 特有表达式集中到 dialect adapter，补齐 PostgreSQL schema 和 migration bundle。
4. 迁移 Profile Translation、Alias redirect 和 localized settings，使用 repository transaction 一次完成。
5. 接入 Supabase PostgreSQL，执行 RLS/索引/连接池/迁移验证和 contract tests。
6. 删除旧的直接 `mysql2` 初始化、重复 store 数据路径和未迁移的 MySQL 方言分支。

## 11. 数据库兼容边界

当前领域仓储和迁移仍以 MySQL 为主。新增 schema 必须通过 repository/service 边界实现，迁移文件不得把 MySQL 方言直接当作 PostgreSQL/Supabase 迁移。Supabase 连接、RLS、事务和迁移验证必须在获得真实项目连接配置后单独执行。

## 12. 完成标准

- 新模块语言包不再修改单一巨型语言文件。
- Profile 的公开内容可按 locale 独立编辑、读取和回退。
- 所有公开内容 URL 使用 Entity alias，代码中不再新增 slug 逻辑。
- Alias 修改有服务端事务、后台确认、301 和缓存失效。
- 语言路由、翻译、Profile、Alias 和设置的单元/接口/浏览器测试全部通过。
