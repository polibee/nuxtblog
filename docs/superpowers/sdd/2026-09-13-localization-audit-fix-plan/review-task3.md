# Task 3 独立只读审查报告

- 审查目标：提交 `e27af75`（`fix: localize public pages and navigation`）
- 对照依据：`docs/superpowers/plans/2026-09-13-localization-audit-fix-plan.md` 的 Task 3
- 审查范围：首页、文章列表/卡片、文章详情、导航、页脚、个人主页、文章按 locale 取数、`publicPath` 依赖和 Task3 测试
- 限制：未运行测试、lint、typecheck 或 build；未修改源码。工作区原有未提交修改均不作为提交内容审查依据。

## Verdict

- **Spec verdict: FAIL（核心交付未闭环）**
- **Code quality verdict: FAIL（提交不可独立构建，新增测试也不与源码一致）**

新增语言包 key 的中英文值基本成对，文章 API 也确实按请求 locale 读取对应的标题、摘要和正文；但提交没有覆盖计划列出的首页、文章卡片、文章详情组件、页脚和语言切换器，且新增代码引用了提交外的文件和不存在的 `publicPath` API。导航英文 fallback 只被孤立测试，没有接入实际解析链路。按提交树静态检查，该提交不能作为独立可交付的 Task3。

## Findings

### [P0] 提交树缺少新增代码的本地依赖，无法独立构建

提交 `e27af75` 的树中不存在以下被引用的文件：

- `app/pages/posts/[alias].vue:120` 导入 `~/components/public/ArticleAuthorCard.vue`，该文件不在提交树中；
- `app/components/public/ProfileProjectCard.vue:3` 导入 `#shared/utils/project-placeholder`，该文件不在提交树中；
- `tests/unit/public-i18n-rendering.test.ts:6` 导入 `../../shared/utils/display-label`，该文件不在提交树中；
- 提交树中的 `app/components/public/LanguageSwitcher.vue:2` 还导入不存在的 `#shared/utils/locale-navigation`，而 Task3 并未把该依赖补入提交。

这些路径在当前工作区可能以未提交文件存在，但不属于 `e27af75`；因此不能把当前工作区的可解析性当作该提交的质量证据。

### [P0] `publicPath` 被多处调用，但 `useLocale()` 没有提供它

`app/composables/useLocale.ts:10-32` 在提交树中只返回 `locale`、`localeCode`、`localePrefix` 和 `setLocale`，没有 `publicPath`。与此同时：

- `app/components/public/NavigationMenu.vue:13-16` 解构并调用 `publicPath`；
- `app/components/public/SiteHeader.vue:11,26` 调用 `publicPath`；
- `app/pages/posts/[alias].vue:129` 解构 `publicPath`，并在 `:10,21,50,60,71,93` 使用；
- 未被本提交修改的 `app/components/public/PostList.vue:31` 和 `PostDetail.vue:85` 也使用同一不存在的 API。

这同时破坏了首页文章列表、文章详情、页眉和页脚（页脚递归使用 `NavigationMenu`）的运行路径，并使 Task3 的公共链接国际化无法成立。

### [P1] Task3 未覆盖计划声明的首页、卡片、页脚和语言切换器，现有缺口仍在

提交文件列表只有 8 个文件；计划列出的 `app/pages/index.vue`、`app/pages/posts/index.vue`、`PostList.vue`、`PostDetail.vue`、`SiteFooter.vue`、`LanguageSwitcher.vue` 均未修改。

静态结果如下：

- 首页 `app/pages/index.vue:17-21` 只渲染 `PublicPostList`，没有使用本提交新增的 `public.home.layoutLabel/layoutList/layoutGrid`；
- 文章页卡片视图 `app/pages/posts/index.vue:14-22` 仍直接显示 `☰`、`▦`，`app/pages/posts/index.vue:47-48` 仍使用未经过 `publicPath` 的 `/posts/...`；两个布局按钮也没有翻译的 `aria-label`；
- `app/components/public/PostList.vue` 和 `PostDetail.vue` 仍调用 `publicPath`，但自身没有取得该函数；
- `app/components/public/SiteFooter.vue:10-18` 没有使用 `common.navigation.footer`，也没有页脚导航的本地化 `aria-label` 或独立链接路径处理；
- `LanguageSwitcher.vue:29-37` 依赖缺失的 `localizedPath`，并调用只接受一个参数的 `setLocale`（`useLocale.ts:22`），提交没有修复该契约。

因此“首页文章卡片、文章内容页、页眉页脚导航不再出现硬编码或原始 key”的验收范围没有完成。

### [P1] 英文导航 fallback 没有接入实际导航解析

Task3 要求英文标签按“英文名称 → Alias → 系统标识”解析。提交新增测试调用 `resolveDisplayLabel`，但实际代码没有使用它：

- `server/modules/navigation/navigation.service.ts:322-352` 的公共 DTO 仍直接返回 `label: item.label`（`344-346`）；
- `app/components/public/NavigationMenu.vue:38,48` 只渲染服务端传来的 `item.label`；
- `resolveDisplayLabel` 本身也不在 `e27af75` 的提交树中。

所以测试中的 resolver 结果不能代表页眉或页脚实际显示结果；英文 variant 缺少合适标签时，仍可能显示存储的中文标签或空标签。

### [P1] `/en` alias 与 locale 状态没有形成可靠的 publicPath 链路

文章页和个人主页分别添加了 `alias: ['/en/posts/:alias']`（`app/pages/posts/[alias].vue:126`）和 `alias: ['/en/profile']`（`app/pages/profile.vue:6`），但提交没有修改 locale middleware/composable：

- `app/middleware/locale.global.ts:6-12` 只从 cookie 初始化 locale，不从当前 URL 的 `/en` 前缀解析；
- `app/composables/useLocale.ts:3-4,18-20` 仍声明开发阶段无 URL 前缀，也没有公开 `publicPath`；
- 因此直接访问 `/en/...` 时，若没有先写入 cookie，页面请求可能仍使用 `zh-CN`，而链接生成也没有稳定的前缀策略。

文章数据按 locale 独立读取这一点本身是正确方向，但 URL 深链、状态和数据三者在本提交中没有闭环。

### [P1] Task3 测试不是渲染测试，并且与提交源码的断言已经不一致

`tests/unit/public-i18n-rendering.test.ts` 存在三个问题：

1. `:16-39` 只直接调用 `useI18n().t()`，没有挂载 Vue 组件，因此没有验证首页、卡片、文章详情、导航、页脚或个人主页的实际渲染。
2. `:44-86` 使用 `readFileSync` 做源码字符串匹配，不能验证 locale 切换后的 URL、请求参数、SSR 深链或 `publicPath` 的返回值；`:90-101` 也只检查字符串存在，不检查 resolver 是否被运行时调用。
3. 断言与 `e27af75` 本身不匹配：`home`（`app/pages/index.vue`）没有 `t('public.home.layoutList')` 或 `layoutGrid`，`footer`（`app/components/public/SiteFooter.vue`）也没有 `function linkPath` 或 `:to="linkPath(child.url)"`。此外测试第 6 行还依赖提交树缺失的 `display-label` 文件。

因此该测试既不能证明计划要求的真实性，也无法作为该提交可通过的 focused regression test。

## Passed checks

- `app/i18n/locales/en/common.ts:131-133,276-277,289,326-327` 与 `zh-CN/common.ts` 对应位置均补充了中英文 key，新增值的集合和插值参数目前一致。
- `app/pages/profile.vue:52-64` 将个人主页 section 类型改为受控 `switch` 映射到 `t()`，`ProfileProjectCard.vue:53,79,116-117` 的 placeholder、featured、visit 和 GitHub 文案也走翻译 key。
- 文章详情页 `app/pages/posts/[alias].vue:132-135` 显式把 `localeCode` 传给文章 API；服务端 `server/repositories/post.repository.ts:396-424` 同时约束 `postTranslations.localeId` 和稳定的 `posts.alias`，`server/modules/posts/post.service.ts:467-484` 返回该 locale 的 title、excerpt、content，而不是用导航标签替代文章字段。这部分符合“文章语言独立性”的数据设计。
- 个人主页 `app/pages/profile.vue:27-30` 也显式传递 locale，section 标题使用 UI 翻译，动态 profile 内容仍来自 profile API。

## Verification note

按用户要求没有运行 `npm test`、任何 focused test、lint、typecheck 或 build。以上结论来自 `e27af75` 与其父提交的静态 diff、提交树依赖检查和源码审阅；`Passed checks` 仅表示静态上看到的局部正确性，不替代运行时验证。
