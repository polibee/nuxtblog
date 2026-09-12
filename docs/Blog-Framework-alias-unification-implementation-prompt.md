# 博客框架 Alias 统一设计实施说明

## 1. 文档用途

本文档是现有博客框架的独立变更实施单，供其他 AI 或开发者快速完成 Alias 统一、多语言路由和导航菜单适配。

完整背景以以下文档为准：

- Blog-Framework-v1.0-nuxtadmin-architecture.md
- Blog-Framework-navigation-menu-design.md

本次变更的核心是统一 alias、key、code 的边界，并消除新代码中对 Translation.slug 的依赖。

---

## 2. 最终设计结论

### 2.1 内容实体统一使用 Entity 级 alias

以下内容实体必须保存 Entity 级 alias：

    posts.alias
    pages.alias
    categories.alias
    tags.alias

Alias 规则：

- 英文小写、数字和短横线。
- 格式：[a-z0-9]+(?:-[a-z0-9]+)*。
- 不允许中文、空格、斜杠、查询参数和语言后缀。
- 在对应 Entity 表内唯一。
- 放在 Entity 主表，不放在 Translation 表。
- 不随语言改变。
- 发布后默认不可静默修改。

示例：

    文章标题：React 路由实践
    Post alias：react-router

    zh-CN：/posts/react-router
    en-US：/en/posts/react-router
    ja-JP：/ja/posts/react-router

不同语言只改变：

1. URL 语言前缀。
2. 当前语言的标题和内容 Translation。
3. 当前语言的 Header/Footer Navigation Variant。
4. 当前语言的 SEO 文案。

禁止生成 react-router-en、react-router-ja 这类语言副本。

### 2.2 Translation 只保存人类可读内容

进入 Translation 的字段包括：

- title
- name
- excerpt
- content
- description
- menu label
- SEO title
- SEO description
- Media Alt/Caption

Translation 不再保存内容实体的公开 URL alias。

### 2.3 alias、key、code 不混用

| 类型 | 用途 | 示例 | 进入公开 URL |
|---|---|---|---:|
| alias | 内容实体的稳定公开 URL 标识 | react-router | 是 |
| key | 系统配置、菜单位置、模板内部标识 | header、footer | 否 |
| code/provider_key | 支付、AI 等外部集成标识 | stripe、openai | 否 |
| label/title/name | 面向用户显示的多语言文本 | 文章、Blog | 否 |

不要为以下对象增加无意义 alias：

- User
- Comment
- Payment
- Session
- Analytics Event
- 内部日志和操作记录

Membership Plan 只有在需要独立公开详情页和 SEO 页面时才增加 alias。

---

## 3. 数据库修改要求

### 3.1 Entity 表增加 alias

为以下表增加非空 alias 字段和唯一索引：

    posts.alias
    pages.alias
    categories.alias
    tags.alias

推荐：

    alias varchar(120) not null
    unique(alias)

v1 默认按 Entity 表和路由命名空间分别唯一：

    posts.alias       -> /posts/{alias}
    pages.alias       -> /{alias} 或 /pages/{alias}
    categories.alias  -> /category/{alias}
    tags.alias        -> /tag/{alias}

### 3.2 Translation 表移除公开 slug

新模型中不要继续使用：

    post_translations.slug
    page_translations.slug
    category_translations.slug
    tag_translations.slug

Translation 唯一约束：

    UNIQUE(entity_id, locale_id)
    INDEX(locale_id)

如果旧项目已有 slug，Migration 只做一次 slug 到 Entity.alias 的映射：

1. 规范化为英文小写和短横线。
2. 处理空值和重复值。
3. 处理保留路径冲突。
4. 记录无法自动转换的内容。
5. 新 API 和新组件统一只使用 alias。

不要长期同时保留 slug 和 alias 两套公开路由字段。

### 3.3 URL 重定向记录

Alias 修改时必须保留旧地址：

    url_redirects
    ├── id
    ├── entity_type
    ├── entity_id
    ├── locale_id nullable
    ├── old_path
    ├── new_path
    ├── status_code       301 | 308
    ├── created_at
    └── expires_at nullable

Alias 修改流程：

1. 校验新 alias。
2. 保存旧 alias 对应的完整旧路径。
3. 更新 Entity.alias。
4. 写入 url_redirects。
5. 清理旧路径、新路径、菜单、Sitemap、RSS 和 SEO 缓存。
6. 旧路径返回 301 或 308，不直接渲染内容。

---

## 4. 路由和 Resolver 修改

### 4.1 公开路由

统一使用：

    app/pages/posts/[alias].vue
    app/pages/category/[alias].vue
    app/pages/tag/[alias].vue
    app/pages/[alias].vue

查询接口统一改为：

    getPostByAlias({ locale, alias })
    getPageByAlias({ locale, alias })
    getCategoryByAlias({ locale, alias })
    getTagByAlias({ locale, alias })

不要继续新增 getPostBySlug、[slug].vue 或 Translation.slug 逻辑。

### 4.2 内容解析顺序

    请求
      ↓
    resolveLocale(request)
      ↓
    识别路由命名空间和 alias
      ↓
    按 Entity 表查询 alias
      ↓
    检查 Entity 状态、删除状态和访问权限
      ↓
    按 requestedLocale 查询 Translation
      ↓
    Translation 不存在或不可公开：404/隐藏
      ↓
    生成当前 Locale 的内容、canonical、hreflang 和 SEO 信息

菜单、语言切换器、Sitemap、RSS 和 canonical 必须复用同一个 Alias-aware route resolver，不能各自拼接 URL。

### 4.3 Page 根路径冲突

如果 Page 使用 /{alias}，必须拒绝：

    admin
    api
    posts
    category
    tag
    preview
    sitemap.xml
    rss.xml

如果无法稳定保证根路径不冲突，统一使用：

    /pages/{alias}

---

## 5. 菜单模块修改要求

### 5.1 Entity Link

Page、Post、Category 菜单项只保存：

    target_entity_type
    target_entity_id

不要保存：

    resolved_url
    url_zh
    url_en
    target_slug

菜单渲染时：

1. 根据当前请求 Locale 查找 Navigation Variant。
2. 读取目标 Entity。
3. 读取当前 Locale Translation。
4. 读取 Entity.alias。
5. 通过 route resolver 生成当前语言 URL。
6. Translation 缺失、Entity 未发布或不存在时隐藏菜单项，并在后台显示警告。

### 5.2 菜单标签

菜单显示文字优先级：

    navigation_item_translations.label
    → 当前 Locale 的 Entity title/name
    → 无标题则隐藏

菜单 label 是多语言文本，不能当作 alias。

### 5.3 多语言菜单切换

同一位置维护不同语言 Variant：

    Header / zh-CN
    Header / en-US
    Header / ja-JP

    Footer / zh-CN
    Footer / en-US
    Footer / ja-JP

启用新语言时：

1. 创建 Header/Footer 对应 Locale Variant。
2. 推荐从默认语言复制菜单结构为草稿。
3. 复制 Entity 引用和排序关系。
4. 不复制新的 alias。
5. 翻译菜单 label 和目标内容 Translation。
6. 审核后发布该语言 Variant。

语言切换时，Header/Footer 自动按请求 Locale 读取对应 Variant，不由前端硬编码替换中文菜单。

### 5.4 Custom Link

Custom Link 可以在每个 Locale Variant 中保存不同的 custom_url。

允许：

- 相对路径
- http://
- https://
- 按产品策略允许 mailto:、tel:

禁止：

- javascript:
- data:
- vbscript:
- 未校验的危险协议

内部内容链接优先使用 Entity Picker，不要求管理员手工填写 URL。

---

## 6. 缓存和事件失效

Alias 或 Translation 变化后，至少处理：

    content:{type}:{id}:{locale}
    navigation:{location}:{locale}
    page:{locale}:{path}
    sitemap:{locale}
    rss:{locale}
    seo:{locale}:{path}

以下情况必须清理引用该内容的当前语言菜单缓存：

- Entity.alias 修改。
- Entity 发布或取消发布。
- Translation 创建、更新、删除。
- Entity 删除或恢复。
- Locale 启用或禁用。

建议事件：

    content.alias.updated
    content.published
    content.unpublished
    translation.updated
    navigation.updated
    locale.enabled
    locale.disabled

Analytics 不应成为菜单保存和菜单渲染的硬依赖。统计失败不能阻塞页面、导航或发布流程。

---

## 7. 后台管理界面修改

### 7.1 内容编辑页

在 Post、Page、Category、Tag 编辑页添加 Alias 字段：

- 字段标签：Alias。
- 帮助文案：英文小写、数字和短横线，用于公开 URL。
- 显示格式化后的预览 URL。
- 输入时实时提示格式错误和重复值。
- 发布后修改显示风险提示。
- 修改已发布内容时要求确认是否生成 301。

Alias 不进入 Locale Tabs。Locale Tabs 只展示标题、正文、名称和 SEO 文本。

### 7.2 菜单可视化编辑器

必须支持：

- Header/Footer 位置选择。
- Locale Variant 选择。
- Page、Post、Category、Custom Link 添加。
- 左侧选择器添加，右侧树编辑。
- 拖拽排序和最多 3 层嵌套。
- 菜单 label、打开方式、rel、nofollow 编辑。
- 缺 Translation、未发布、目标删除和 alias 无效警告。
- 语言 Variant 复制为草稿。
- 保存事务、RBAC 和缓存失效。

---

## 8. 推荐实施顺序

1. 增加 Entity.alias 字段和唯一索引。
2. 编写 alias 格式、保留字和重复值校验。
3. 执行旧 slug 到 Entity.alias 的数据迁移。
4. 增加 url_redirects 表和 alias 修改服务。
5. 修改 Repository 和 Service，提供 getByAlias 方法。
6. 修改公开路由和 SSR 页面参数为 [alias]。
7. 修改 Sitemap、RSS、canonical、hreflang 和语言切换器。
8. 修改 Navigation Resolver 使用 Entity.alias。
9. 修改 Header/Footer 多语言 Variant 解析。
10. 修改后台内容编辑页和菜单可视化编辑器。
11. 增加缓存、事件、301 和多语言测试。
12. 删除新代码中的 slug 依赖，仅保留迁移兼容代码。

---

## 9. 交给其他 AI 的直接执行指令

    你正在修改一个 Nuxt 4 + Nitro + Vue 3 + TypeScript + NuxtAdmin + MySQL 的博客框架。

    请先阅读：
    1. Blog-Framework-v1.0-nuxtadmin-architecture.md
    2. Blog-Framework-navigation-menu-design.md
    3. Blog-Framework-alias-unification-implementation-prompt.md
    4. NuxtAdmin 当前 Resource、Module、RBAC、缓存、事件和公开路由实现

    本次目标：
    把 Posts、Pages、Categories、Tags 的公开标识统一为 Entity 级英文 alias，
    并让多语言菜单、公开路由、SEO 和重定向都使用同一套 Alias-aware resolver。

    必须完成：
    1. posts/pages/categories/tags 增加唯一 alias。
    2. 新代码停止使用 Translation.slug。
    3. 增加 alias 格式、重复值、保留路径和发布后修改校验。
    4. 增加 url_redirects，alias 修改生成 301 或 308。
    5. 将公开路由参数从 slug 改为 alias。
    6. 提供 getPostByAlias/getPageByAlias/getCategoryByAlias/getTagByAlias。
    7. 同一个 Entity 在不同 Locale 使用同一个 alias。
    8. 当前 Locale 只改变 URL 前缀、Translation 和 Navigation Variant。
    9. Navigation Entity Link 只保存 Entity 类型和 ID，不保存最终 URL。
    10. Header/Footer 按请求 Locale 读取对应菜单 Variant。
    11. Translation 缺失或目标未发布时，公开菜单隐藏，后台显示原因。
    12. alias、Translation、发布状态变化时清理页面、菜单、Sitemap、RSS 和 SEO 缓存。
    13. 修改后台内容编辑页和 WordPress 风格菜单编辑器。
    14. 补充 Migration、Unit、Integration、SSR 和 Playwright E2E 测试。

    必须遵守：
    1. 不为不同语言生成不同 alias。
    2. 不再新增 [slug].vue、getBySlug 或 Translation.slug 逻辑。
    3. 不把菜单最终 URL 写死在数据库。
    4. 不用中文标题直接当公开 URL。
    5. 不把 key/code 和 alias 混为一谈。
    6. 不给 User、Comment、Payment、Session、Analytics Event 添加无意义 alias。
    7. 不修改 NuxtAdmin Core，优先通过业务模块扩展。
    8. Analytics 不能成为页面和菜单的硬依赖。

    开发要求：
    1. 先检查现有实现，列出受影响文件和数据库迁移计划。
    2. 再分阶段修改，每完成一阶段运行对应测试。
    3. 不覆盖用户已有数据和未提交修改。
    4. 报告无法自动转换的 slug 和需要人工确认的路由冲突。
    5. 最后输出变更文件、测试结果、已知问题和回滚方案。

---

## 10. 完成验收清单

### 数据模型

- [ ] Post/Page/Category/Tag 都有 Entity.alias。
- [ ] alias 为英文小写、数字和短横线。
- [ ] alias 在对应 Entity 表内唯一。
- [ ] Translation 不再保存新 slug。
- [ ] url_redirects 可记录旧路径和新路径。

### 内容和路由

- [ ] 公开路由使用 [alias]。
- [ ] getByAlias 方法可用。
- [ ] zh-CN 和其他 Locale 使用同一个 alias。
- [ ] 语言前缀正确。
- [ ] 缺失 Translation 返回 404 或隐藏。
- [ ] alias 修改返回 301/308。
- [ ] 保留路径不会被 Page alias 占用。

### 菜单

- [ ] Header/Footer 分开管理。
- [ ] 每个 Locale 有独立 Variant。
- [ ] Page/Post/Category/Custom Link 可添加。
- [ ] Entity Link 不保存最终 URL。
- [ ] 菜单根据当前 Locale 解析标题和 alias URL。
- [ ] 缺失 Translation 的菜单项被隐藏并有后台警告。
- [ ] 菜单排序和嵌套有效。
- [ ] 菜单保存后缓存失效。

### 质量和安全

- [ ] RBAC 在服务端再次校验。
- [ ] Custom Link 协议经过服务端校验。
- [ ] alias 输入经过服务端校验。
- [ ] alias 修改有权限和确认机制。
- [ ] Migration 有检查和回滚方案。
- [ ] Unit、Integration、SSR、Build、E2E 通过。
- [ ] 统计采集失败不影响页面和导航。

完成标准：Alias、路由、菜单、SEO、多语言和重定向使用同一套稳定规则，且新代码中不再出现未迁移的 slug 业务逻辑。
