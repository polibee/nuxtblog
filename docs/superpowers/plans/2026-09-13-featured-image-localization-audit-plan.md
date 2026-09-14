# Featured Image and Localization Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复文章特色图片全链路，并建立模块化、可审计、不会混用中英文的前后端多语言体系，同时将文章正文外部链接统一为本地化网站卡片。

**Architecture:** 先统一文章实体的 `featuredMediaId` 契约，保留旧翻译字段只读回退；再以聚合入口拆分 UI 语言包，后端返回稳定错误 code，展示层按 locale 解析 Embed 文案。每个阶段通过单元/API/浏览器回归验证，最后执行全项目质量门禁。

**Tech Stack:** Nuxt 4、Vue 3、TypeScript、Nitro/H3、Drizzle ORM、Laragon MySQL、Vitest、现有 Tailwind/shadcn-vue 风格组件。

**Spec:** `docs/superpowers/specs/2026-09-13-featured-image-localization-audit-design.md`

## Global Constraints

- 当前数据库继续使用 Laragon MySQL，不在本计划中迁移 Supabase/PostgreSQL。
- 文章特色图片属于文章实体，后台、Repository、公开 API 统一使用 `featuredMediaId`。
- `post_translations.featured_image_id` 只作为旧数据读取回退，不作为新数据写入入口。
- 文章标题、正文、摘要和评论不自动互译；中文文章与英文文章独立筛选。
- 资源英文显示规则为：英文名称 → Alias → 系统英文标识；不能回退显示中文名称。
- 外部 Embed 只允许 HTTPS；禁止 javascript/data 协议、任意 iframe 和脚本执行。
- 所有管理端 handler 继续执行现有 `requireUser`/`requirePermission` 鉴权。
- 不修改侧边栏作者卡片、文章作者卡片和全站导航视觉结构。
- 每个任务先写回归测试，再写最小实现；不得关闭 ESLint/TypeScript 规则。

---

### Task 1: 固化特色图片字段契约

**Files:**
- Modify: `shared/schemas/post.ts`
- Modify: `server/modules/posts/post.service.ts`
- Modify: `server/repositories/post.repository.ts`
- Modify: `server/repositories/post.postgres.repository.ts`
- Modify: `server/repositories/post.runtime.repository.ts`
- Test: `tests/unit/post-featured-image.test.ts`

**Interfaces:**
- Consumes: `PostInput.featuredMediaId` and existing `PostRecord.featuredMediaId`.
- Produces: `createPost()` and `updatePost()` only write the top-level entity field; public mappers continue returning `coverUrl`.

- [ ] **Step 1: Write failing contract tests**

Add tests that assert a valid input carries `featuredMediaId`, an explicit `null` clears it, and a translation-only `featuredImageId` is not used as a new entity input:

```ts
it('accepts top-level featuredMediaId and explicit null', () => {
  expect(postInputSchema.parse({ featuredMediaId: 12 }).featuredMediaId).toBe(12)
  expect(postInputSchema.parse({ featuredMediaId: null }).featuredMediaId).toBeNull()
})

it('does not expose translation featuredImageId as a top-level field', () => {
  expect(() => postInputSchema.parse({ featuredImageId: 12 })).toThrow()
})
```

- [ ] **Step 2: Run the focused test and verify it fails or exposes the current mismatch**

Run: `npm test -- --run tests/unit/post-featured-image.test.ts`

Expected: the new test file initially fails because the repository/service compatibility behavior is not yet asserted.

- [ ] **Step 3: Make the service contract explicit**

Keep `featuredMediaId` at the top level in `createPost()` and `updatePost()`. Change translation row construction so it does not copy a new `featuredImageId` from input. Keep repository read mapping as:

```ts
coverMediaId: row.translationFeaturedId ?? row.featuredMediaId
```

and add a comment that `translationFeaturedId` is legacy-read-only compatibility.

- [ ] **Step 4: Run focused tests**

Run: `npm test -- --run tests/unit/post-featured-image.test.ts tests/unit/post-excerpt.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit only this task**

```bash
git add shared/schemas/post.ts server/modules/posts/post.service.ts server/repositories/post.repository.ts server/repositories/post.postgres.repository.ts server/repositories/post.runtime.repository.ts tests/unit/post-featured-image.test.ts
git commit -m "fix: unify post featured image contract"
```

### Task 2: 修复后台特色图片编辑回显

**Files:**
- Modify: `app/admin/framework/MediaPickerField.vue`
- Modify: `app/modules/posts/admin/PostResource.ts`
- Modify: `server/api/admin/media/[id].get.ts` (use the existing media detail route if present)
- Test: `tests/unit/media-picker-field.test.ts`
- Test: `tests/unit/post-resource.test.ts`

**Interfaces:**
- Consumes: `featuredMediaId` returned by the admin post detail endpoint.
- Produces: MediaPicker renders a selected media record even when it is outside the current page.

- [ ] **Step 1: Write failing component/resource tests**

Cover these cases:

```ts
it('keeps the selected media visible when it is not in the current page', async () => {
  // mock page without id 12, then mock detail response for id 12
  // mount with modelValue: 12 and assert filename is rendered
})

it('post resource uses the top-level featuredMediaId field', () => {
  const fields = resource.form!(translator).flatMap(sectionFields)
  expect(fields.some(field => field.name === 'featuredMediaId')).toBe(true)
})
```

- [ ] **Step 2: Run focused tests to verify the missing rehydration behavior**

Run: `npm test -- --run tests/unit/media-picker-field.test.ts tests/unit/post-resource.test.ts`

Expected: FAIL until the selected media detail is loaded.

- [ ] **Step 3: Implement selected-media rehydration**

When `modelValue` is a positive ID and `selectedMedia` is missing after `reload()`, request `/api/admin/media/:id`, merge the response into `items`, and guard the request with the existing loading/abort behavior. When clearing, emit `null`; when choosing, emit the numeric ID.

- [ ] **Step 4: Add the recommended image hint without changing the public card layout**

Configure the existing post media picker with the project’s recommended cover ratio/size hint. Keep cover image rendering separate from body image styles.

- [ ] **Step 5: Run focused tests and lint**

Run: `npm test -- --run tests/unit/media-picker-field.test.ts tests/unit/post-resource.test.ts`; then `npm run lint -- --quiet`.

Expected: PASS with no new lint errors.

- [ ] **Step 6: Commit only this task**

```bash
git add app/admin/framework/MediaPickerField.vue app/modules/posts/admin/PostResource.ts server/api/admin/media/[id].get.ts tests/unit/media-picker-field.test.ts tests/unit/post-resource.test.ts
git commit -m "fix: restore featured image edit preview"
```

### Task 3: 特色图片 API 与公开页面回归

**Files:**
- Modify: `server/api/admin/posts/[id].get.ts`
- Modify: `server/api/admin/posts/[id].put.ts`
- Modify: `server/modules/posts/post.service.ts`
- Test: `tests/unit/post-public-cover.test.ts`
- Test: `tests/e2e/post-featured-image.spec.ts`

**Interfaces:**
- Consumes: Task 1 entity contract and Task 2 editor field.
- Produces: admin detail/create/update and public summary/detail/archive cover behavior.

- [ ] **Step 1: Write failing API/public regression tests**

Assert the following sequence with a MySQL-backed test fixture or the repository test harness:

```ts
const created = await createPost({ ...validPost, featuredMediaId: 12 }, adminId)
expect(created.featuredMediaId).toBe(12)
expect((await getPublicPostByAlias('zh-CN', created.alias))?.coverUrl).toBe('/media/12')

await updatePost(created.id, { featuredMediaId: null })
expect((await getPublicPostByAlias('zh-CN', created.alias))?.coverUrl).toBeNull()
```

- [ ] **Step 2: Run the regression test and confirm the current failure**

Run: `npm test -- --run tests/unit/post-public-cover.test.ts`

Expected: FAIL if admin response or public mapping drops the field.

- [ ] **Step 3: Fix the smallest broken mapping**

Ensure admin handlers pass the request body unchanged to `post.service`, and `finalize()` preserves `featuredMediaId`. Ensure `getPublicPosts()`, `getPublicPostByAlias()`, and archive mappers call `coverUrlFor(row.coverMediaId)` exactly once per item.

- [ ] **Step 4: Add browser flow coverage**

The E2E test must log in as the existing administrator, open `/admin/posts/:id/edit`, choose a media record, save, reload, open the public post, assert the cover image source, then clear and assert the cover is absent. Do not delete existing test data; create a uniquely aliased draft fixture and clean only that fixture through the test API.

- [ ] **Step 5: Run focused API and browser tests**

Run: `npm test -- --run tests/unit/post-public-cover.test.ts`; run the project’s configured Playwright wrapper for `tests/e2e/post-featured-image.spec.ts` if available.

Expected: unit test PASS; browser result must record any unavailable MySQL/auth prerequisite instead of skipping silently.

- [ ] **Step 6: Commit only this task**

```bash
git add server/api/admin/posts/[id].get.ts server/api/admin/posts/[id].put.ts server/modules/posts/post.service.ts tests/unit/post-public-cover.test.ts tests/e2e/post-featured-image.spec.ts
git commit -m "test: cover featured image public flow"
```

### Task 4: 建立模块化 UI 语言包聚合入口

**Files:**
- Create: `app/i18n/locales/zh-CN/common.ts`
- Create: `app/i18n/locales/zh-CN/admin.ts`
- Create: `app/i18n/locales/en/common.ts`
- Create: `app/i18n/locales/en/admin.ts`
- Modify: `app/admin/i18n/index.ts`
- Test: `tests/unit/i18n-bundles.test.ts`

**Interfaces:**
- Consumes: existing `t(key)` and `useI18n()` callers.
- Produces: same translation API with module files as the source of truth.

- [ ] **Step 1: Write failing key parity tests**

Add a pure test that flattens both locale objects and asserts identical key sets for `common` and `admin`, with an explicit allowlist only for keys intentionally server-only:

```ts
it('keeps zh-CN and en key sets aligned', () => {
  expect(flattenKeys(zhCommon)).toEqual(flattenKeys(enCommon))
  expect(flattenKeys(zhAdmin)).toEqual(flattenKeys(enAdmin))
})
```

- [ ] **Step 2: Run the focused test and capture missing keys**

Run: `npm test -- --run tests/unit/i18n-bundles.test.ts`

Expected: FAIL with the current missing-key list.

- [ ] **Step 3: Extract common/admin keys without changing callers**

Move existing common/admin entries from `app/admin/i18n/index.ts` into the new files. The index must import and deep-merge them into the existing locale registry. Keep key strings stable so components do not require a broad rewrite.

- [ ] **Step 4: Add module bundle placeholders only with real translations**

Create `posts`, `comments`, `advertising`, `settings`, `commerce`, `media`, and `ai` bundles only when their keys are migrated in Tasks 5–6. Do not add fake empty translations; a missing key must be reported by the parity test.

- [ ] **Step 5: Run tests and typecheck**

Run: `npm test -- --run tests/unit/i18n-bundles.test.ts`; then `npm run typecheck`.

Expected: PASS.

- [ ] **Step 6: Commit only this task**

```bash
git add app/i18n app/admin/i18n/index.ts tests/unit/i18n-bundles.test.ts
git commit -m "refactor: split ui locale bundles"
```

### Task 5: 迁移公共壳层与核心内容模块文案

**Files:**
- Create/Modify: `app/i18n/locales/zh-CN/posts.ts`, `comments.ts`, `settings.ts`, `media.ts`
- Create/Modify: `app/i18n/locales/en/posts.ts`, `comments.ts`, `settings.ts`, `media.ts`
- Modify: `app/components/public/PostDetail.vue`
- Modify: `app/components/public/PostList.vue`
- Modify: `app/components/public/SiteFooter.vue`
- Modify: `app/components/public/LanguageSwitcher.vue`
- Modify: `app/modules/comments/admin/CommentsResource.ts`
- Modify: `app/modules/settings/admin/SettingsWorkspacePage.vue`
- Modify: `app/modules/media/admin/MediaLibraryPage.vue`
- Test: `tests/unit/localized-core-ui.test.ts`

**Interfaces:**
- Consumes: Task 4 aggregate `t()` registry and `useLocale()`.
- Produces: no new hardcoded UI copy in these core modules.

- [ ] **Step 1: Write failing hardcoded-copy and switch tests**

Test that public header/footer/detail and selected admin modules render the active locale’s label after changing the locale state, and that known English pages do not contain the Chinese labels for loading/error/actions.

- [ ] **Step 2: Run the focused test**

Run: `npm test -- --run tests/unit/localized-core-ui.test.ts`

Expected: FAIL where components currently use inline literals or fixed English Embed labels.

- [ ] **Step 3: Replace literals with namespaced keys**

Use keys such as `posts.actions.open`, `posts.meta.views`, `common.actions.openLink`, `common.status.loading`, and `common.errors.loadFailed`. Do not translate article title/body/excerpt values.

- [ ] **Step 4: Verify locale switching without a manual refresh**

Ensure the component watches locale changes and refetches locale-sensitive public data; preserve route/query parameters. The page must update through the existing locale composable instead of forcing a full browser reload.

- [ ] **Step 5: Run focused tests, lint, and typecheck**

Run: `npm test -- --run tests/unit/localized-core-ui.test.ts`; `npm run lint -- --quiet`; `npm run typecheck`.

Expected: PASS.

- [ ] **Step 6: Commit only this task**

```bash
git add app/i18n app/components/public/PostDetail.vue app/components/public/PostList.vue app/components/public/SiteFooter.vue app/components/public/LanguageSwitcher.vue app/modules/comments/admin/CommentsResource.ts app/modules/settings/admin/SettingsWorkspacePage.vue app/modules/media/admin/MediaLibraryPage.vue tests/unit/localized-core-ui.test.ts
git commit -m "fix: localize core public and admin ui"
```

### Task 6: 统一资源 Alias/英文名称显示规则

**Files:**
- Modify: `shared/utils/display-label.ts`
- Modify: `shared/utils/locale-navigation.ts`
- Modify: `app/components/public/NavigationMenu.vue`
- Modify: `app/components/public/SiteFooter.vue`
- Modify: `app/modules/navigation/admin/NavigationItemPicker.vue`
- Modify: resource definitions under `app/modules/**/admin/*.ts`
- Test: `tests/unit/display-label.test.ts`
- Test: `tests/unit/locale-navigation.test.ts`

**Interfaces:**
- Consumes: `{ locale, defaultLabel, localizedLabel, alias, systemKey }`.
- Produces: deterministic display labels and locale-aware target URLs.

- [ ] **Step 1: Expand failing display-label tests**

Cover these exact cases:

```ts
expect(resolveDisplayLabel({ locale: 'en', defaultLabel: '技术分类', localizedLabel: '', alias: 'tech', systemKey: '' })).toBe('tech')
expect(resolveDisplayLabel({ locale: 'en', defaultLabel: '关于我们', localizedLabel: 'About us', alias: 'about', systemKey: '' })).toBe('About us')
expect(resolveDisplayLabel({ locale: 'zh-CN', defaultLabel: '技术分类', localizedLabel: 'Technology', alias: 'tech', systemKey: '' })).toBe('技术分类')
```

- [ ] **Step 2: Run tests and verify current behavior**

Run: `npm test -- --run tests/unit/display-label.test.ts tests/unit/locale-navigation.test.ts`

Expected: FAIL for any Chinese fallback in English context.

- [ ] **Step 3: Apply the resolver at all resource label boundaries**

Use the shared resolver for header/footer navigation, page/category/tag labels, settings resource names, commerce/advertising/admin labels. Keep article title/body rendering independent.

- [ ] **Step 4: Run focused tests and inspect SSR output**

Run the focused tests and request one Chinese and one English public page. Assert that missing English labels render Alias and that no route path is used as visible text.

- [ ] **Step 5: Commit only this task**

```bash
git add shared/utils/display-label.ts shared/utils/locale-navigation.ts app/components/public/NavigationMenu.vue app/components/public/SiteFooter.vue app/modules/navigation/admin/NavigationItemPicker.vue app/modules tests/unit/display-label.test.ts tests/unit/locale-navigation.test.ts
git commit -m "fix: standardize alias display fallback"
```

### Task 7: 后端错误 code 与模块状态文案治理

**Files:**
- Create: `shared/i18n/error-codes.ts`
- Modify: affected handlers under `server/api/**`
- Modify: affected services under `server/modules/**`
- Modify: `app/admin/i18n/index.ts` and module locale bundles
- Test: `tests/unit/error-code-localization.test.ts`

**Interfaces:**
- Consumes: existing `createError` status semantics.
- Produces: `{ code, params }` error payloads with stable HTTP status and localized client messages.

- [ ] **Step 1: Write failing error payload tests**

Assert representative errors preserve 401/403/422/409/503 and expose a code without secrets or SQL text:

```ts
expect(error.statusCode).toBe(422)
expect(error.data.code).toBe('POST_FEATURED_MEDIA_NOT_FOUND')
expect(JSON.stringify(error.data)).not.toMatch(/password|select .* from|DATABASE_URL/i)
```

- [ ] **Step 2: Run the focused tests**

Run: `npm test -- --run tests/unit/error-code-localization.test.ts`

Expected: FAIL until handlers use stable error codes.

- [ ] **Step 3: Add the error-code map and migrate high-value paths**

Start with posts/media, comments, notifications, advertising, settings, auth, orders/payments, and AI. Keep `statusMessage` safe and generic; the client uses the code and params for localized display.

- [ ] **Step 4: Run focused tests and verify auth/permission semantics**

Run: `npm test -- --run tests/unit/error-code-localization.test.ts tests/unit/comment-service-settings.test.ts tests/unit/notification-channel.test.ts`.

Expected: PASS with unchanged HTTP semantics.

- [ ] **Step 5: Commit only this task**

```bash
git add shared/i18n/error-codes.ts server/api server/modules app/i18n app/admin/i18n/index.ts tests/unit/error-code-localization.test.ts
git commit -m "refactor: standardize localized api errors"
```

### Task 8: Embed 通用卡片的 locale 展示与历史数据兼容

**Files:**
- Modify: `shared/utils/article-embed.ts`
- Modify: `server/modules/posts/post.service.ts`
- Modify: `app/components/public/PostDetail.vue`
- Modify: `app/admin/framework/RichTextEditor.vue`
- Modify: `server/utils/sanitize.ts`
- Test: `tests/unit/article-embed.test.ts`
- Test: `tests/unit/article-embed-locale.test.ts`

**Interfaces:**
- Consumes: external HTTPS URLs and historical provider-specific card HTML.
- Produces: one generic card shape with localized action label; no raw URL text in the card.

- [ ] **Step 1: Write failing locale/compatibility tests**

```ts
expect(normalizeArticleEmbeds('https://github.com/polibee/nuxtblog', { locale: 'zh-CN' })).toContain('打开链接')
expect(normalizeArticleEmbeds('https://github.com/polibee/nuxtblog', { locale: 'en' })).toContain('Open link')
expect(normalizeArticleEmbeds('<blockquote class="article-embed article-embed-github"><a href="https://example.com">old</a></blockquote>')).toContain('example.com')
```

- [ ] **Step 2: Run focused tests and verify the current fixed-English behavior**

Run: `npm test -- --run tests/unit/article-embed.test.ts tests/unit/article-embed-locale.test.ts`

Expected: FAIL because the current helper has fixed English copy and only partial legacy conversion.

- [ ] **Step 3: Add locale-aware card rendering without changing article content semantics**

Use an options object with a default locale for compatibility:

```ts
normalizeArticleEmbeds(content: string, options?: { locale?: 'zh-CN' | 'en' }): string
```

Render the same `article-embed-link` structure for GitHub, X, and other sites. The left side contains the hostname; the right side is an anchor styled as a button. Do not display the full URL as visible text.

- [ ] **Step 4: Pass the request/article locale at public render time**

Update the public post service to normalize content with the requested locale. The editor uses its selected locale. Keep sanitization after normalization and preserve `target`, `rel`, `class`, and safe `href` attributes.

- [ ] **Step 5: Run focused tests and SSR verification**

Run: `npm test -- --run tests/unit/article-embed.test.ts tests/unit/article-embed-locale.test.ts`; request `/posts/demo-mysql-observatory` and its English variant, asserting the card label changes while the anchor URL remains identical.

- [ ] **Step 6: Commit only this task**

```bash
git add shared/utils/article-embed.ts server/modules/posts/post.service.ts app/components/public/PostDetail.vue app/admin/framework/RichTextEditor.vue server/utils/sanitize.ts tests/unit/article-embed.test.ts tests/unit/article-embed-locale.test.ts
git commit -m "feat: localize article link cards"
```

### Task 9: 全模块语言混用扫描与自动化审计命令

**Files:**
- Create: `scripts/audit-localization.mjs`
- Create: `scripts/audit-public-routes.mjs`
- Modify: `package.json`
- Test: `tests/unit/localization-audit.test.ts`
- Test: `tests/unit/public-route-audit.test.ts`

**Interfaces:**
- Consumes: source tree, locale bundles, public route registry, and existing Vitest utilities.
- Produces: deterministic nonzero exit codes for missing locale keys, unsafe hardcoded UI copy, duplicate route aliases, or invalid public labels.

- [ ] **Step 1: Write failing script/unit tests**

Test the scripts against fixture strings containing a hardcoded Chinese label in an English module, a missing English key, and a duplicate public alias.

- [ ] **Step 2: Run the focused tests and verify they fail**

Run: `npm test -- --run tests/unit/localization-audit.test.ts tests/unit/public-route-audit.test.ts`

Expected: FAIL because the audit scripts do not exist.

- [ ] **Step 3: Implement deterministic audits**

The localization audit must flatten locale keys, report sorted missing/extra keys, and scan only UI source paths (`app/components`, `app/modules`, `app/admin`) for known hardcoded business labels. It must ignore tests, docs, content data, and CSS. The route audit must verify root page aliases, `/posts/:alias`, locale prefixes, and legacy redirect routes without opening external URLs.

- [ ] **Step 4: Add npm scripts**

Add:

```json
{
  "audit:localization": "node scripts/audit-localization.mjs",
  "audit:routes": "node scripts/audit-public-routes.mjs"
}
```

- [ ] **Step 5: Run audit scripts and focused tests**

Run: `npm run audit:localization`; `npm run audit:routes`; `npm test -- --run tests/unit/localization-audit.test.ts tests/unit/public-route-audit.test.ts`.

Expected: PASS with a documented list of any intentionally allowed literals.

- [ ] **Step 6: Commit only this task**

```bash
git add scripts package.json tests/unit/localization-audit.test.ts tests/unit/public-route-audit.test.ts
git commit -m "test: add localization and route audits"
```

### Task 10: 全项目自动化回归与交付闸门

**Files:**
- Modify: `docs/superpowers/specs/2026-09-13-featured-image-localization-audit-design.md` (mark completed items only after evidence)
- Modify: `docs/phases/**` only for verified phase notes
- Test: `tests/e2e/**` relevant article/localization flows

**Interfaces:**
- Consumes: all prior task contracts and audit commands.
- Produces: evidence-backed verification report with passed and unavailable checks separated.

- [ ] **Step 1: Run all unit/integration tests**

Run: `npm test -- --run`.

Expected: all existing and new tests pass; record exact file/test totals.

- [ ] **Step 2: Run static checks**

Run: `npm run lint`; `npm run typecheck`; `git diff --check`.

Expected: exit code 0 with no suppressed rules.

- [ ] **Step 3: Run browser regression flows**

Run the configured E2E wrapper for:

- post cover select/save/replace/clear;
- Chinese/English article route and content isolation;
- language switch without manual refresh;
- common link card label and button target;
- page/category/navigation Alias display;
- representative settings/comments/advertising/admin permission screens.

Record database/auth prerequisites explicitly if a flow cannot run; do not mark it passed from SSR alone.

- [ ] **Step 4: Build production output**

Run: `npm run build`.

Expected: build completes. Existing chunk-size or Node deprecation warnings may be reported separately, but build errors block completion.

- [ ] **Step 5: Review the worktree**

Run: `git status --short`; ensure no `.data/`, `.output/`, temporary patch, secret, or local database file is staged. Preserve unrelated user changes.

- [ ] **Step 6: Produce the delivery report**

Report modified files, exact verification commands/results, browser/database limitations, and any remaining hardcoded labels. Do not claim production readiness if an essential E2E or MySQL flow was unavailable.

