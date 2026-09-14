# Localization Audit and Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) to implement this plan task-by-task. Each task requires focused tests, independent review, and a separate commit.

**Goal:** 消除前台和后台中英文混用、原始 i18n key 泄漏、语言切换不刷新和语言包不一致问题。

**Architecture:** 以模块化 locale bundle 为唯一文案来源，以静态 key 使用审计和运行时渲染回归保护契约；页面数据请求通过 locale composable 统一刷新，动态资源名称通过受控 resolver 回退到 Alias。

**Tech Stack:** Nuxt 4, Vue 3, TypeScript, Vitest, ESLint, vue-tsc。

**Spec:** `docs/architecture/通用架构设计与开发约束.md`

## Global Constraints

- 中文是默认语言；英文名称为空时使用 Alias 或系统英文标识。
- 文章标题、摘要和正文按文章自身语言独立维护。
- UI 文案不得硬编码，不得把未注册 key 直接显示给用户。
- 动态 key 必须来自受控映射，不能拼接用户输入。
- 语言切换必须同步 URL、数据请求、导航、页面标题和 SEO metadata。
- 保留用户已有未提交修改；每个任务只提交自己的精确文件和 hunks。
- 每个任务必须运行 focused tests、lint、typecheck，并经过独立审查。

---

### Task 1: i18n 使用审计器

**Files:**
- Create: `scripts/audit-i18n-usage.ts`
- Create: `tests/unit/i18n-usage-audit.test.ts`
- Modify: `package.json`（仅增加审计脚本）

**Produces:** `npm run audit:i18n`，输出缺失 key、原始 key 风险、未受控动态 key 和硬编码文案位置，并以非零退出码阻止回归。

- [ ] 为 `.vue`/`.ts` 中静态 `t('key')`、`t("key")` 和 `$t('key')` 写失败测试。
- [ ] 读取 zh/en 聚合语言包，报告两种语言缺失或多余 key。
- [ ] 识别无法静态解析的动态 key，允许显式白名单映射并拒绝任意用户输入拼接。
- [ ] 识别模板中直接输出已知 i18n key 的风险，但忽略权限码、API 字段和数据库列名。
- [ ] 增加 npm script，运行审计、focused tests、lint、typecheck 并提交。

### Task 2: 语言包完整性和模块归属

**Files:**
- Modify: `app/i18n/locales/zh-CN/*.ts`, `app/i18n/locales/en/*.ts`
- Modify: `app/admin/i18n/index.ts`
- Test: `tests/unit/i18n-bundles.test.ts`, `tests/unit/i18n-usage-audit.test.ts`

**Produces:** 所有审计发现的 key 均有模块归属，zh/en 集合和值参数一致。

- [ ] 按审计输出补齐 profile/home/posts/navigation/comments/settings 等缺失 key。
- [ ] 对每个插值 key 比较参数集合，不允许只翻译一部分参数。
- [ ] 删除或迁移无调用方的重复 key，不删除已有兼容 key。
- [ ] 运行 bundle、audit、lint、typecheck 并提交。

### Task 3: 公共页面和导航文案迁移

**Files:**
- Modify: `app/pages/index.vue`, `app/pages/posts/index.vue`, `app/pages/posts/[alias].vue`, `app/pages/profile.vue`
- Modify: `app/components/public/PostList.vue`, `PostDetail.vue`, `NavigationMenu.vue`, `SiteFooter.vue`, `LanguageSwitcher.vue`
- Test: `tests/unit/public-i18n-rendering.test.ts`

**Produces:** 首页文章卡片、文章内容页、个人主页、页眉页脚导航不再出现硬编码或原始 key。

- [ ] 用真实 `t()` 渲染测试覆盖 layoutList/layoutGrid/viewProfile 等已知问题。
- [ ] 保留文章原始语言独立显示，不用导航 Alias 替代文章标题。
- [ ] 验证导航/页脚英文标签按“英文名称→Alias→系统标识”解析。
- [ ] 运行 focused tests、lint、typecheck 并提交。

### Task 4: locale 切换刷新链路

**Files:**
- Modify: `app/composables/useLocale.ts`, `app/middleware/locale.global.ts`, `app/app.vue`
- Modify: public pages using locale-dependent `useFetch`
- Test: `tests/unit/locale-refresh.test.ts`

**Produces:** 点击语言切换后 URL、数据、标题和 SEO 同步更新，无需手动刷新。

- [ ] 测试 `/`、`/en/`、文章列表、文章详情、分类和个人主页的 locale 参数。
- [ ] 取消旧请求并防止旧 locale 响应覆盖新页面。
- [ ] 验证浏览器前进/后退和深链接刷新。
- [ ] 运行 focused tests、lint、typecheck 并提交。

### Task 5: 后台 UI 和错误文案回归

**Files:**
- Modify: `app/admin/framework/*`, `app/modules/*/admin/*`, `app/error.vue`
- Test: `tests/unit/admin-i18n-rendering.test.ts`

**Produces:** 后台设置、文章、评论、媒体、广告、通知、AI 等页面不再显示混合语言或原始 key。

- [ ] 将表单、Action、错误、空状态和确认提示迁移到正确模块 bundle。
- [ ] 约束动态资源标签使用 display-label resolver。
- [ ] 验证权限不足、网络错误和保存成功提示均有中英文文案。
- [ ] 运行 focused tests、lint、typecheck 并提交。

### Task 6: 全量质量与浏览器回归

**Files:**
- Create: `tests/e2e/localization-regression.spec.ts`（若浏览器工具可用）
- Create: `docs/audits/2026-09-13-localization-audit-report.md`

- [ ] 运行 `npm run audit:i18n`。
- [ ] 依次运行 `npm run lint`、`npm run typecheck`、`npm test -- --run`、`npm run build`。
- [ ] 浏览器验证中文/英文首页、文章列表/详情、导航、页脚、个人主页、后台设置。
- [ ] 报告 Playwright、真实数据库和外部服务未执行项，不把它们标为通过。
