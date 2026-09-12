# P04 Posts + Taxonomy

## 1. 基本信息

~~~text
Phase ID: P04
Phase Name: Posts + Taxonomy
Owner: polibee
NuxtAdmin Base Commit: a48695f
Depends On: P00, P02, P03
Target Version: v0.1.0-p04
Status: COMPLETE
~~~

## 2. 目标与非目标

### 2.1 目标

- posts + post_translations：Entity/Translation 事务拆分写入；draft/scheduled/published/archived 生命周期；primary locale 完整度（title/slug/content）作为发布闸门；slug 每 locale 唯一 + 标题自动生成；content 服务端 sanitize-html。
- categories/tags + translations：多对多关系表 post_categories/post_tags 绑定 Entity id；slug 每 locale 唯一；管理员按语言编辑（LocalizedField）。
- 后台：/api/admin/posts、categories、tags 静态目录接管；PostResource 重写（状态徽标、排期、access_type、特色图 relation、分类/标签 multirelation、SEO 字段、批量发布、公开页跳转）；scheduler 每 15s 提升到期排期文章（实测 22s 自动发布）。
- 公开面：/api/public/posts(+slug)/categories/tags；页面 /posts/[slug]、/category/[slug]、/tag/[slug]、首页文章列表；全部严格按请求 Locale、无跨语言 fallback；noindex 排除出列表与 sitemap。
- SEO：RSS/Sitemap 接真实文章（locale 作用域缓存键）；详情页 seoTitle/seoDescription/noindex 接 useSeoMeta。
- P03 follow-up：上传图片宽高探测（PNG/JPEG/GIF header 嗅探）。

### 2.2 非目标

- 不做修订/自动保存（基座能力，P05 评估接入）、不做阅读量统计（P09 Analytics）。
- members 访问级别仅落字段，付费拦截在 P12 Paid Content。
- 不做分页路由/归档页（/posts 列表页由首页承担，P17 Theme 可扩展）。

## 3. NuxtAdmin 接入点

~~~text
Module: app/modules/posts（PostResource 重写）、app/modules/taxonomy（categories/tags 双资源工厂）
Resource: posts / categories / tags（permissionPrefix 各自同名）
Server API: /api/admin/{posts,categories,tags} 静态目录接管；/api/public/{posts,posts/:slug,categories,tags}
Server Service: server/modules/posts/post.service.ts、server/modules/taxonomy/taxonomy.service.ts
Server Repository: post.repository.ts、taxonomy.repository.ts、schema/posts.ts、schema/taxonomy.ts
Event hooks: emitAdminEvent('posts:refresh')；scheduler 提升排期
Framework: multirelation 字段类型（ADR-0003）
Permissions: posts.* / categories.* / tags.*（editor 映射已扩充全部三项）
~~~

## 4. 数据模型

### 4.1 Entity

~~~text
posts: id, primary_locale_id FK locales, author_id FK users, featured_media_id FK media SET NULL,
       access_type(public|members), status(draft|scheduled|published|archived),
       published_at, scheduled_at, comment_status(open|closed), deleted_at, created_at, updated_at
       INDEX(status/published_at/author/primary_locale)
categories/tags: id + timestamps
post_categories / post_tags: PK(post_id, taxonomy_id) 双向索引，双 FK CASCADE
~~~

### 4.2 Translation

~~~text
post_translations: title/slug/excerpt/content/seo_title/seo_description/canonical_url/noindex/
                   featured_image_id(按语言特色图覆盖)
   UNIQUE(post_id, locale_id)；UNIQUE(locale_id, slug)；INDEX(locale_id)
category/tag_translations: name/slug/description，UNIQUE(entity, locale)、UNIQUE(locale, slug)
Public completeness rule: 发布要求主语言 title/slug/content 非空；公开列表排除 noindex
~~~

### 4.4 Migration

~~~text
0006_posts_taxonomy.sql（8 表）+ 0007_post_noindex_boolean.sql（noindex→boolean）
注意：mediumtext 不能有 DEFAULT（MySQL 限制），content 列无默认值
Rollback: DROP 8 表
~~~

## 5. Repository 与 Service

- post.repository：管理端分页/搜索（跨语言 title/slug LIKE）/状态过滤；listPublished/findPublishedBySlug（published + published_at<=now + 指定 locale 翻译存在）；promoteScheduledPosts；coverUrlFor。
- post.service：zod strict（postInputSchema）；buildTranslationRows（未知 locale 422、ensureSlug 自动生成、sanitizeRichText）；checkStatus（发布完整度 422、排期需未来时间）；关系 replace-all（分类/标签 id 校验 422）；publishedAt 仅在进出 published 状态时维护；AdminPost 附主语言 title 预览；公开读取 getPublicPosts/getPublicPost（分类/标签 slug 过滤求交集）。
- taxonomy.service：kind 工厂（category/tag 共用）；slug 每语言唯一预检 409；publicTerms/findIdBySlug。

## 6. Resource / Widget

PostResource：列表（title/状态徽标/发布/创建时间 + 发布、查看公开 Action + 批量发布）；表单（状态/access/评论、排期时间、特色图 relation(media)、分类/标签 multirelation、LocalizedField(title/slug/excerpt/content/SEO/noindex)）；infolist。
categories/tags：共用工厂，LocalizedField(name/slug/description)。

## 7. Route 与 API

~~~text
GET/POST /api/admin/posts           posts.view/create（POST 注入当前用户为 author）
GET/PUT/DELETE /api/admin/posts/:id posts.view/edit/delete
GET/POST /api/admin/categories|tags + :id（categories.*/tags.*）
GET /api/public/posts?locale&page&perPage&category&tag   公开
GET /api/public/posts/:slug?locale                       公开，404 不存在
GET /api/public/categories|tags?locale                   公开
GET /rss.xml / /sitemap.xml                              locale 作用域缓存键
~~~

Server 检查：显式 import ✓ / Handler 无 SQL ✓ / 经 Service ✓ / Server 权限 ✓ / 401/404/409/422 统一映射 ✓。

## 8. Analytics

不适用（P09）。

## 9. 权限矩阵

| 操作 | 未登录 | Viewer | Editor | Admin |
|---|---:|---:|---:|---:|
| 公开文章/分类/标签 | ✅ | ✅ | ✅ | ✅ |
| 文章管理 | ❌ 401 | ❌ | ✅ | ✅ |
| 分类/标签管理 | ❌ | ❌ | ✅ | ✅ |

## 10. 多语言检查

[x] 自然语言字段全部入 Translation 表  [x] slug 每 locale 唯一（DB 唯一键）  [x] 发布闸门=主语言完整度  [x] 公开读取无跨语言 fallback（en slug 英文访问 200、不存在组合 404）  [x] rss/sitemap/公开端点缓存键含 locale  [x] 新增 Locale 零 schema 改动

## 11. 测试计划

- Unit（新增 tests/unit/post-schema.test.ts）：slugifyTitle/ensureSlug（CJK 回退时间戳 slug）、postInputSchema strict、taxonomyInputSchema、multirelation zod。
- Integration（实测）：创建分类/标签（双语）、草稿不完整→发布 422、完整文章发布→公开可见、script 剥离、en/zh 隔离、404、分类过滤、排期 22s 自动提升、RSS/Sitemap 收录、删除。
- 浏览器：首页文章列表、详情页（SEO 标题/分类/标签链接）、分类归档、后台文章列表。

## 12. 验收标准（节选）

~~~text
Given 主语言翻译不完整（无 content）
When PUT status=published
Then 422 且文章保持草稿

Given 已发布文章带分类/标签
When 访问 /posts/{slug} 与 /category/{slug}
Then 内容渲染（script 已剥离）、归档页只显示该分类文章

Given status=scheduled 且 scheduled_at 到期
When scheduler tick
Then 自动转 published 并出现在公开 API/RSS/Sitemap

Given 请求 locale 无对应翻译
When 访问该 slug
Then 404（不回退其他语言）
~~~

## 13. 质量闸门

~~~text
npm run lint      → PASS
npm run typecheck → PASS
npm test          → PASS（122 tests / 18 files）
npm run build     → PASS
集成/浏览器       → 全链路实测通过（含守卫/隔离/排期/SEO 面）
~~~

## 14. 发布、监控与回滚

~~~text
Migration 顺序: 0006、0007（追加）
日志指标: [scheduler] promoted N scheduled posts
回滚方式: DROP 8 表 + 还原资源/路由
备注: listPublished 为有界扫描（limit 500）+ JS 过滤，数据量增长后 P19 下推 SQL
~~~

## 15. 完成记录

~~~text
Phase Status: COMPLETE
Acceptance: PASS
Known Issues:
  - multirelation 选项上限 200（与 relation 一致），大数据量需搜索式选择器（ADR-0003 备注）
  - 公开列表分页 API 已就绪，页面级分页控件未做（首页取前 10）
Follow-up: P05 Pages；P07 Comments（comment_status 已就位）；P09 Analytics
~~~
