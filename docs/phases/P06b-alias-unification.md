# P06b Alias 统一（依据 alias-unification-implementation-prompt.md）

## 1. 基本信息

~~~text
Phase ID: P06b
Phase Name: Alias Unification
Owner: polibee
NuxtAdmin Base Commit: a48695f
Depends On: P04, P05, P06
Target Version: v0.2.0-p06b
Status: COMPLETE
~~~

## 2. 实现范围（对照实施单 §9 必须完成清单）

1. **Entity 级 alias**：posts/pages/categories/tags 增加非空唯一 alias（varchar(120)，UNIQUE），英文小写+数字+短横线（^[a-z0-9]+(?:-[a-z0-9]+)*$），不随语言变化（迁移 0012）。
2. **Translation 停用 slug**：四个 Translation 表的 slug 列与 UNIQUE(locale, slug) 索引已删除；新代码无 getBySlug。
3. **校验**：aliasSchema（格式）、RESERVED_ALIASES（admin/api/posts/pages/category/tag/preview/login 等，422）、重复 409；create/update 均校验。
4. **url_redirects**：新表记录旧/新路径（301）；已发布内容修改 alias 时自动写入 301 并失效导航缓存；nitro 中间件 server/middleware/redirects.ts 拦截旧路径（永不渲染旧内容）。
5. **路由 [alias]**：/posts/[alias]、/category/[alias]、/tag/[alias]、/pages/[alias]；handler getRouterParam('alias')。
6. **getByAlias**：getPostByAlias/getPageByAlias/findTaxonomyIdByAlias；公开查询按 Entity 表 alias + 请求 Locale Translation（缺失 404）。
7. **同 Entity 同 alias**：迁移把默认语言 slug 回填为 Entity.alias（页面/分类/标签取默认语言，Post 取 primary_locale_id），非默认语言的旧 slug（如 /posts/getting-started）一次性写入 url_redirects（301）。
8. **多语言只换前缀/翻译/菜单 Variant**：URL 由 contentUrl(entityType, alias) 统一生成（menu/sitemap/RSS/语言切换同源）。
9. **导航**：resolveItem 改用 findPublished*AliasById + contentUrl；不落库最终 URL。
10. **Header/Footer Variant**：按请求 Locale 解析（P06 已实现，保持）。
11. **缺失翻译隐藏**：菜单/公开查询均隐藏；别名无效/未发布在编辑器警告（picker 标签来自真实标题）。
12. **缓存失效**：alias 变更 → 记录 301 + invalidateAllNavigationCaches（页面缓存 TTL 兜底；§6 精细事件清单留 P19）。
13. **后台 UI**：Post/Page/Category/Tag 编辑页 alias 字段在 Locale Tabs 之外（帮助文案：英文小写+全站唯一+301 说明）；菜单编辑器目标摘要显示实体标题。
14. **测试**：alias 格式/保留字/去重（post-schema 单测更新）；集成实测 301、同 alias 多 Locale、404。

## 3. 迁移与数据

~~~text
0012_alias_unification.sql：
  ADD alias（nullable）→ 默认语言 slug 回填 → 兜底 CONCAT(prefix,id)
  → MODIFY NOT NULL → UNIQUE 索引
  → CREATE url_redirects
  → 为被删除的非默认语言 slug 写入 301（含 /posts/getting-started）
  → DROP 四表 slug 列与 locale_slug 唯一索引
0011：default_flag 生成表达式按 navigation 分组（P06 修正，见 P06 文档）
~~~

## 4. 验证结果

~~~text
npm run lint      → PASS
npm run typecheck → PASS
npm test          → PASS（124 tests / 18 files）
npm run build     → PASS
集成/浏览器       →
  GET /posts/nuxt4-blog-start        → 200
  GET /posts/getting-started（旧）   → 301 → /posts/nuxt4-blog-start
  /api/public/posts                   → 返回 alias 字段
  后台文章编辑页                      → Alias 字段（Locale Tabs 外）+ 301 帮助文案
  导航 resolveItem                    → Entity.alias + contentUrl
~~~

## 5. 完成记录

~~~text
Phase Status: COMPLETE
Acceptance: PASS
Known Issues:
  - Page 使用 /pages/{alias} 命名空间（根路径 /{alias} 需保留字清单稳定后于 P17 启用）
  - 缓存失效的精细事件总线（content.alias.updated 等）留待 P19
  - published 后改 alias 的客户端二次确认暂以帮助文案提示，服务端自动 301
Follow-up: P07 Comments；P20 语言前缀路由（/{locale}/posts/{alias}）
~~~
