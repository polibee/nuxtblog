# P18 前端界面 v1（依据 docs/前端设计.txt）

## 1. 基本信息

~~~text
Phase ID: P18
Phase Name: 公开前端界面 v1（F01-F08 核心项）
Owner: polibee
NuxtAdmin Base Commit: a48695f
Depends On: P04（文章/分类/标签）、P05（页面）、P06（导航）、P15（会员/付费）、P16（侧边栏卡片）、P17（广告）
Target Version: v0.2.0-p18
Status: COMPLETE
设计依据：docs/前端设计.txt（98 节公开前端设计文档）
~~~

## 2. 实现范围（摘要）

- **站点外壳**：Sticky 紧凑 Header（h-14 + 毛玻璃）内嵌桌面搜索框（提交跳 /search?q=）；两栏布局保留（内容 + 320px 侧边栏，移动端单栏、侧边栏下沉）
- **文章列表 /posts**：标题栏 + 列表/卡片视图切换（localStorage 持久化 `public-post-view`）；列表视图带缩略图（156×104 桌面）；卡片视图 16:10 封面 + 分类 + 标题 + 摘要 + 作者/日期；经典分页（← 1 2 3 →，纯 `<a>` 锚点保 SSR 全页导航利于 SEO/回退）；新增 PublicPostSummary.authorName
- **文章详情 /posts/[alias]**：面包屑（首页/分类/标题）；Header 增加 作者 + 阅读时长（CJK 400 字/分 + 英文 220 词/分）；正文 h2/h3 自动注入稳定 id 并提取目录——移动端文章头部折叠展示（lg:hidden）、桌面端侧边栏 sticky TOC（lg:sticky，经 useState('article-toc') 注册到布局，IntersectionObserver 高亮当前小节）；顶部阅读进度条（fixed 2px）；上一篇/下一篇（带标题）；相关文章（同分类，排除自身取 3 篇）；作者卡（首字母头像）；Article JSON-LD 结构化数据
- **搜索 /search**：搜索框 + 结果列表（q LIKE 标题/摘要）；结果计数；空结果提示 + 标签建议 chips；noindex
- **归档 /archive**：新端点 GET /api/public/archive（轻量列查询，不含 content，500 条上限）→ 按 年 → 月 分组，月份本地化名称 + 计数
- **分类 /categories、标签 /tags**：词条总览卡片/Badge 链接
- **错误页 app/error.vue**：404/500 大字号 + 文案 + 返回首页按钮
- **i18n**：新增 27 组 zh/en 公开文案（public.posts/post/search/archive/categories/tags/error/nav.home）
- **组件**：Pagination / ArticleToc / ReadingProgress / BackToTop（app/components/public/，显式导入）

### P18b 增补（同日）

- **深色主题切换器**：复用基座 useUiStore（admin-theme cookie，SSR 可读无闪烁），ThemeToggle 组件（日/月 SVG）接入公开 Header；.dark class 策略（main.css @custom-variant 已有）
- **搜索关键词高亮**：blog.ts splitHighlight（正则转义 + 大小写不敏感分段）→ PostList 增加 highlight prop，title/excerpt 命中词渲染 <mark class="bg-primary/15">
- **卡片浏览量徽标**：analytics.repository.listViewCounts(path IN + event_type=page_view + is_bot=false，GROUP BY path) → getPublicPosts 批量聚合 → PublicPostSummary.views → 列表/卡片 👁 n（formatViews：≥1000 → x.xk）
- **卡片图片统一裁剪**：列表视图缩略图全视口显示（移动 96×64 / sm 156×104）object-cover；无封面时占位块（bg-muted + 标题首字母）；卡片视图同款占位

## 3. 验证结果

~~~text
npm run lint      → PASS（0 errors；RichTextEditor v-html 既有警告 1 条可接受）
npm run typecheck → PASS
npm test          → PASS（167 tests / 21 files）
npm run build     → PASS
真实 MySQL E2E    → PASS（dev server + curl 结构化验证）
~~~

## 4. 真实环境 E2E（Laragon MySQL 8.0.30 + dev server）

- GET /api/public/archive → { year:2026, month:9, day:9, title, alias }
- /posts /archive /categories /tags /search?q=Nuxt /posts/[alias] /membership /store 全部 200
- /search?q=Nuxt → 命中 1 篇 + "找到 1 篇文章"
- /posts → 视图切换按钮（☰/▦）+ 全部文章标题
- 详情页 → 面包屑"首页"、阅读时长、application/ld+json 注入
- /posts/does-not-exist → 404 + 自定义错误页（text-7xl / 页面不存在 / 返回首页）
- P18b：/api/public/posts 返回 views:3；/posts 含 👁 徽标 + bg-muted 占位；/search?q=Nuxt 命中 <mark>Nuxt</mark>；Cookie admin-theme=dark → SSR `<html class="dark"`；ThemeToggle 按钮（aria 切换主题）在 Header
- 浏览器截图验证被安全分类器拦截，以 curl HTML 结构化验证替代

## 5. 完成记录

~~~text
Phase Status: COMPLETE
Acceptance: PASS（四道闸门 + 真实环境端到端）
Known Issues: TOC 在标题数 <3 时隐藏（阈值设计）；相关文章仅按第一分类匹配；列表卡片浏览量/评论数未接入（analytics 未公开化）
Follow-up: 卡片视图浏览量徽标、移动端 TOC 展开动画、搜索高亮、浅色/深色主题切换器（public nav 预留位）
~~~
