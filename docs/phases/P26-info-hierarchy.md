# P26 卡片与详情页信息层级优化

## 1. 基本信息

~~~text
Phase ID: P26
Phase Name: 首页卡片/文章详情信息层级重排（用户排版反馈）
Owner: polibee
NuxtAdmin Base Commit: a48695f
Depends On: P18（卡片）、P24（详情）
Target Version: v0.2.0-p26
Status: COMPLETE
~~~

## 2. 实现范围（摘要）

### 冻结规格

~~~text
首页卡片：分类 · 日期 → 标题 → 摘要 → 作者 · 阅读时间 · 浏览量
文章详情：Breadcrumb → 分类(轻) → 标题 → 摘要 → 作者 · 日期 · 阅读时间 · 浏览量 → 正文
字号：卡片标题 20px(text-xl)、摘要 14-15px muted、详情标题 36-42px(text-3xl→4xl)
分隔：明确 " · " 分隔符；分类略突出(primary/90)、日期/浏览量弱化(muted)
~~~

### 服务端

- readingMinutes 移至 shared/utils/reading.ts（服务端/客户端共用），app/utils/blog.ts re-export
- PublicPostSummary += readingMinutes；getPublicPosts 逐条计算（listPublished 已含 content）
- getPublicPostByAlias 补 views（analytics listViewCounts 按 path 聚合）

### 前端

- PostList（列表视图/首页）：顶行 分类·日期（分类 primary/90、日期 muted、· 分隔）；底行 作者 · ⏱ 阅读时间 · 👁 浏览量；标题 text-xl
- posts/index 卡片视图：同规格
- PostDetail 头部重排：分类轻行 → 标题 text-3xl→sm:text-4xl → 摘要 15px muted → 元信息行（作者 · 日期 · ⏱ · 👁）；分类不再以 Badge 强调（面包屑保留，视觉轻）

## 3. 验证结果

~~~text
npm run lint      → PASS（0 errors；既有 v-html 警告 1 条可接受）
npm run typecheck → PASS
npm test          → PASS（167 tests / 21 files）
npm run build     → PASS
真实环境 E2E      → PASS
~~~

## 4. E2E 验证

- GET /api/public/posts → items[0] 含 readingMinutes=1、views、authorName
- GET /api/public/posts/[alias] → views + readingMinutes
- /posts/[alias] SSR：text-primary/80 分类轻行、text-3xl 标题、👁 元信息在位

## 5. 完成记录

~~~text
Phase Status: COMPLETE
Acceptance: PASS（四道闸门 + 结构化验证）
Known Issues: 无
Follow-up: 无
~~~

## 6. 增补（同日，用户二次反馈——减法）

- **面包屑去掉完整文章标题**：只保留 首页 / 分类（消除标题连续重复两次）
- **删除独立分类行**：分类只在面包屑出现一次
- **元信息去 emoji**：⏱/👁 移除 → `Administrator · 2026年9月9日 · 1 分钟阅读 · 17 次浏览`（新增 i18n public.post.viewsCount）
- **作者降级**：font-medium（不再与标题/Heading 竞争）
- **间距**：H1 mt-3 摘要、mt-5 元信息（12px/20px 分层）
- **标签**：去 `#` 前缀 → 「标签」label + secondary 小 Badge（rounded-full bg-secondary）
- 元信息结构最终冻结：作者 · 日期 · 阅读时间 · 浏览次数——每个信息只出现一次
