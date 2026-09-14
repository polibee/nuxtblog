# Auth Profile Comments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在现有 MySQL + Drizzle 项目中实现公开注册、用户中心、会员勋章、现代化评论、管理员回复、公开个人主页和文章页多语言一致性。

**Architecture:** 保留当前 `users/sessions/comments/membership` 领域模型，新增 `user_profiles/user_preferences/badges/user_badges`，所有读写经过 Repository Contract 和 domain service。公开页面只消费安全的 View Model；个人主页、侧栏和文章页复用同一 `ResolvedAuthorCard`。

**Tech Stack:** Nuxt 4、Vue 3.5、TypeScript、Nitro/H3、Drizzle ORM、MySQL、Tailwind CSS v4、Pinia、Vitest、Playwright、Cloudflare Turnstile。

**Spec:** `docs/superpowers/specs/2026-09-12-auth-profile-comments-design.md`

## Global Constraints

- 当前开发数据库固定使用 Laragon MySQL + Drizzle；本计划不引入 Supabase Auth 或第二套身份来源。
- 服务端 API 必须先执行 `requireUser` 或 `requirePermission`，客户端权限过滤不能替代服务端鉴权。
- 数据访问只能经过 `server/repositories/**` 或既有服务端抽象，API 文件不得散落 SQL。
- 密码使用现有 scrypt；Session cookie 使用 httpOnly、sameSite=lax，并按环境决定 secure。
- 游客网址只允许站内相对路径、HTTP(S) 或 mailto；公开外链使用 `nofollow noopener noreferrer`。
- 评论正文在服务端清洗；公开接口不返回邮箱、原始 IP、完整 User-Agent、密码或内部权限数组。
- Cloudflare secret 只能在服务端配置或加密设置中保存，不能进入客户端 bundle。
- UI 文案使用现有 Translator/i18n；自然语言内容使用实体 Translation，不新增 `*_zh/*_en` 字段。
- 任何写操作都必须补回归测试；每个阶段都运行 lint、typecheck、unit test，最终运行 build 和关键 E2E。
- 保留工作区已有修改，不使用 `git reset --hard`、`git checkout --` 或批量清理。

## File Map

| Area | Files | Responsibility |
| --- | --- | --- |
| Auth/account | `app/pages/register.vue`, `app/pages/account.vue`, `server/modules/account/account.service.ts` | 注册、资料、安全、个人数据聚合 |
| User data | `server/repositories/user-profile.repository.ts`, `server/repositories/badge.repository.ts` | 个人资料和勋章持久化 |
| Comment data | `shared/schemas/comment.ts`, `server/repositories/comment.repository.ts`, `server/modules/comments/comment.service.ts` | 评论字段、身份、回复和公开 View Model |
| Comment UI | `app/components/public/PostComments.vue`, `app/modules/comments/admin/CommentsResource.ts` | 游客/登录评论、回复、审核和设备信息 |
| Author UI | `app/components/public/AuthorCardView.vue`, `ProfileHero.vue`, `ArticleAuthorCard.vue` | 侧栏、文章、个人页三种作者卡片变体 |
| Public pages | `app/pages/profile.vue`, `app/pages/posts/[alias].vue`, `app/components/public/PostDetail.vue` | 个人页和文章阅读体验 |
| Locale/SEO | `shared/utils/locale-navigation.ts`, `server/api/public/posts/[alias].get.ts` | 目标语言 alias、内部链接和 SEO |
| Schema/migration | `server/repositories/schema/users.ts`, `schema/comments.ts`, `schema/badges.ts`, `migrations/0037_auth_profile_comments.sql` | MySQL schema 和迁移 |

### Task 1: Extend user profile, preferences, and registration

**Files:**
- Create: `server/repositories/schema/user-profiles.ts`
- Create: `server/repositories/user-profile.repository.ts`
- Create: `server/modules/account/account.service.ts`
- Create: `server/api/auth/register.post.ts`
- Create: `server/api/auth/profile.get.ts`
- Create: `server/api/auth/profile.put.ts`
- Create: `server/api/auth/change-password.post.ts`
- Create: `app/pages/register.vue`
- Create: `app/pages/account.vue`
- Modify: `server/repositories/migrations/0037_auth_profile_comments.sql`
- Modify: `app/admin/i18n/index.ts`
- Test: `tests/unit/account-schema.test.ts`, `tests/unit/account-service.test.ts`

**Interfaces:**
- Consumes: `getSessionUser`, `requireUser`, `createSession`, `verifyPassword`, existing `users` schema.
- Produces: `registerUser(input: RegisterUserInput): Promise<AuthUser>`, `getOwnProfile(userId): Promise<UserProfileView>`, `updateOwnProfile(actorId,userId,input): Promise<UserProfileView>`, `changePassword(userId,currentPassword,newPassword): Promise<void>`.

```ts
interface RegisterUserInput { email: string, name: string, password: string }
interface UserProfileView { userId: number, name: string, email: string, websiteUrl: string | null, bio: string, avatarUrl: string | null, locale: string, timezone: string }
```

- [ ] **Step 1: Write the failing tests**

```ts
it('normalizes registration email and creates a viewer', async () => {
  const user = await registerUser({ email: ' User@Example.COM ', name: 'Lee', password: 'long-password' })
  expect(user.email).toBe('user@example.com')
  expect(user.role).toBe('viewer')
})

it('rejects changing another user profile', async () => {
  await expect(updateOwnProfile(1, 2, { name: 'x' })).rejects.toMatchObject({ statusCode: 403 })
})
```

- [ ] **Step 2: Run tests and verify the expected failure**

Run: `npm test -- --run tests/unit/account-schema.test.ts tests/unit/account-service.test.ts`

Expected: FAIL because the account service and profile repository contracts do not exist.

- [ ] **Step 3: Add schema, repository contracts, and migration**

```ts
export interface UserProfileView {
  userId: number
  name: string
  email: string
  websiteUrl: string | null
  bio: string
  avatarUrl: string | null
  locale: string
  timezone: string
}

export interface UserProfileRepository {
  findByUserId(userId: number): Promise<UserProfileView | null>
  upsert(userId: number, input: { websiteUrl?: string | null, bio?: string, locale?: string, timezone?: string, avatarMediaId?: number | null }): Promise<UserProfileView>
}
```

Create `user_profiles` and `user_preferences` with `user_id` primary/unique keys and foreign keys to `users`. The migration must be idempotent and leave existing users valid.

- [ ] **Step 4: Implement registration and own-profile service**

Normalize email before uniqueness lookup, call the existing password hash helper, insert `viewer/active`, create an empty profile row, and return only `AuthUser`. Profile updates validate website protocol and length server-side; password changes verify the current password and revoke all other sessions.

- [ ] **Step 5: Implement pages and localized UI states**

`register.vue` contains email/name/password/confirmation/agreement, pending state, 409 duplicate email, 422 validation and 429 rate-limit messages. `account.vue` uses tabs for overview/profile/security and hides order/会员 sections when no data exists.

- [ ] **Step 6: Run focused verification**

Run: `npm test -- --run tests/unit/account-schema.test.ts tests/unit/account-service.test.ts`; `npm run lint -- --quiet`; `npm run typecheck`.

- [ ] **Step 7: Commit the isolated task**

```bash
git add server/repositories/schema/user-profiles.ts server/repositories/user-profile.repository.ts server/modules/account/account.service.ts server/api/auth app/pages/register.vue app/pages/account.vue server/repositories/migrations/0037_auth_profile_comments.sql app/admin/i18n/index.ts tests/unit/account-schema.test.ts tests/unit/account-service.test.ts
git commit -m "feat: add public registration and user account center"
```

### Task 2: Add badge domain and membership projection

**Files:**
- Create: `server/repositories/schema/badges.ts`
- Create: `server/repositories/badge.repository.ts`
- Create: `server/modules/badges/badge.service.ts`
- Create: `shared/types/badge.ts`
- Modify: `server/modules/membership/membership.service.ts`
- Modify: `server/api/admin/membership/plans/[id].put.ts`
- Modify: `server/api/admin/users/[id].put.ts`
- Modify: `app/modules/users/admin/UserResource.ts`
- Modify: `app/admin/i18n/index.ts`
- Test: `tests/unit/badge-service.test.ts`, `tests/unit/badge-view.test.ts`

**Interfaces:**
- Consumes: membership subscription/order status and authenticated user id.
- Produces: `listPublicBadges(userId,now): Promise<PublicBadgeView[]>`, `grantBadge(input): Promise<void>`, `revokeBadge(userId,badgeKey): Promise<void>`, `getUserIdentityView(userId): Promise<UserIdentityView>`.

- [ ] **Step 1: Write the failing tests**

```ts
it('does not expose an expired VIP badge', async () => {
  const badges = await listPublicBadges(1, new Date('2026-10-01'))
  expect(badges.some(badge => badge.key === 'vip')).toBe(false)
})

it('maps a current membership to VIP without trusting client input', async () => {
  const identity = await getUserIdentityView(1)
  expect(identity.badges.map(item => item.key)).toContain('vip')
})
```

- [ ] **Step 2: Run focused tests and verify failure**

Run: `npm test -- --run tests/unit/badge-service.test.ts tests/unit/badge-view.test.ts`

Expected: FAIL because Badge View types and service are missing.

- [ ] **Step 3: Add tables and repository methods**

Create `badges` with unique `key`, and `user_badges` with user/badge indexes, optional source fields, grant and expiry timestamps. Repository methods return domain types and never expose encrypted/private fields.

- [ ] **Step 4: Implement badge calculation**

Always include `member` for an active user; derive `vip` from an unexpired membership; derive `supporter` from a paid order; allow admin-granted badges by `source_type/source_id`. Filter expired rows before constructing `PublicBadgeView`.

- [ ] **Step 5: Add admin badge controls and account display**

Add a badge list/editor to the user detail resource, with `users.edit` permission. The account overview and future comment View Model consume `UserIdentityView`.

- [ ] **Step 6: Run focused verification and commit**

Run: `npm test -- --run tests/unit/badge-service.test.ts tests/unit/badge-view.test.ts`; `npm run lint -- --quiet`; `npm run typecheck`.

```bash
git add server/repositories/schema/badges.ts server/repositories/badge.repository.ts server/modules/badges shared/types/badge.ts server/modules/membership app/modules/users app/admin/i18n/index.ts tests/unit/badge-service.test.ts tests/unit/badge-view.test.ts
git commit -m "feat: add user badges and membership identity"
```

### Task 3: Upgrade comment schema, guest identity, Gravatar, UA, and Turnstile

**Files:**
- Modify: `server/repositories/schema/comments.ts`
- Modify: `server/repositories/comment.repository.ts`
- Modify: `server/repositories/comment.postgres.repository.ts` only if its contract requires the same fields
- Modify: `shared/schemas/comment.ts`
- Modify: `server/modules/comments/comment.service.ts`
- Modify: `server/api/public/posts/[alias]/comments.post.ts`
- Modify: `app/components/public/PostComments.vue`
- Modify: `server/modules/settings/registry.ts`
- Create: `server/utils/comment-metadata.ts`
- Create: `server/utils/turnstile.ts`
- Modify: `server/repositories/migrations/0037_auth_profile_comments.sql`
- Test: `tests/unit/comment-metadata.test.ts`, `tests/unit/comment-input.test.ts`, `tests/unit/turnstile.test.ts`

**Interfaces:**
- Consumes: current comment submit flow, current user session, `comments.*` settings.
- Produces: `parseCommentMetadata(userAgent): CommentMetadata`, `gravatarHash(email): string`, `verifyTurnstile(token,ip): Promise<boolean>`, `submitComment(...): Promise<CommentSubmissionResult>`.

- [ ] **Step 1: Write failing tests for metadata, URL safety, and captcha**

```ts
it('normalizes browser and operating system without retaining raw User-Agent', () => {
  expect(parseCommentMetadata('Mozilla/5.0 Chrome/120.0 Windows NT 10.0')).toMatchObject({ browserName: 'Chrome', osName: 'Windows' })
})

it('rejects javascript and private guest URLs', () => {
  expect(commentInputSchema.safeParse({ name: 'A', email: 'a@example.com', website: 'javascript:alert(1)', content: 'hello' }).success).toBe(false)
})
```

- [ ] **Step 2: Run tests and verify failure**

Run: `npm test -- --run tests/unit/comment-metadata.test.ts tests/unit/comment-input.test.ts tests/unit/turnstile.test.ts`

Expected: FAIL because metadata parsing, website validation, and Turnstile verification are not implemented.

- [ ] **Step 3: Add nullable comment fields and idempotent migration**

Add `author_url`, `gravatar_hash`, browser/OS/device fields, `ip_hash`, `moderation_reason`, `approved_at`, and `approved_by`. Keep existing rows valid and do not backfill raw User-Agent or IP.

- [ ] **Step 4: Implement metadata and safe URL utilities**

Parse a bounded User-Agent string into browser/OS/device values. Hash IP with a server-side salt. Generate Gravatar hash from lowercase trimmed email. Validate URL protocol, hostname and private/loopback destinations.

- [ ] **Step 5: Implement server-side Turnstile verification**

Send the token to Cloudflare only when `comments.turnstile_enabled` is true. Enforce a short timeout, do not log the secret or token, return false on network/API failure, and reject the comment before repository insert. When disabled, retain existing development behavior explicitly through the setting.

- [ ] **Step 6: Update comment View Models and composer**

Logged-in users omit guest identity fields; guests see name/email/website and Turnstile. Public rows return avatar URL, safe website URL, badges, and optional browser/OS according to settings. Never return `authorEmail` publicly.

- [ ] **Step 7: Run focused verification and commit**

Run: `npm test -- --run tests/unit/comment-metadata.test.ts tests/unit/comment-input.test.ts tests/unit/turnstile.test.ts`; `npm run lint -- --quiet`; `npm run typecheck`.

```bash
git add server/repositories/schema/comments.ts server/repositories/comment.repository.ts shared/schemas/comment.ts server/modules/comments/comment.service.ts server/api/public/posts/[alias]/comments.post.ts app/components/public/PostComments.vue server/modules/settings/registry.ts server/utils/comment-metadata.ts server/utils/turnstile.ts server/repositories/migrations/0037_auth_profile_comments.sql tests/unit/comment-metadata.test.ts tests/unit/comment-input.test.ts tests/unit/turnstile.test.ts
git commit -m "feat: add safe guest comment identity and turnstile"
```

### Task 4: Add administrator replies and modern comment presentation

**Files:**
- Create: `server/api/admin/comments/[id]/reply.post.ts`
- Modify: `server/modules/comments/comment.service.ts`
- Modify: `app/modules/comments/admin/CommentsResource.ts`
- Modify: `app/components/public/PostComments.vue`
- Modify: `shared/schemas/comment.ts`
- Modify: `app/admin/i18n/index.ts`
- Test: `tests/unit/comment-reply.test.ts`
- Test: `tests/e2e/comments.spec.ts`

**Interfaces:**
- Consumes: `requirePermission(event, 'comments.edit')`, comment parent validation, current user identity, badge View.
- Produces: `replyToComment(commentId, input, adminUser): Promise<AdminComment>`, with `parentId`, `userId`, `status`, and sanitized content.

- [ ] **Step 1: Write the failing reply tests**

```ts
it('creates a reply under the target post and records the administrator', async () => {
  const reply = await replyToComment(10, { content: 'Thanks for reporting this.' }, { id: 1, name: 'Admin', email: 'admin@example.com' })
  expect(reply.parentId).toBe(10)
  expect(reply.status).toBe('pending')
})

it('rejects a reply when the visual nesting limit is reached', async () => {
  await expect(replyToComment(99, { content: 'too deep' }, admin)).rejects.toMatchObject({ statusCode: 422 })
})
```

- [ ] **Step 2: Run the focused test and verify failure**

Run: `npm test -- --run tests/unit/comment-reply.test.ts`

Expected: FAIL because the reply service and endpoint do not exist.

- [ ] **Step 3: Implement reply service and endpoint**

Require `comments.edit`, check the target exists, check its post is still valid, enforce maximum depth 3, sanitize text, insert with current admin user id, and use `comments.require_approval` to choose `pending` or `approved`. Return a safe admin View Model.

- [ ] **Step 4: Add admin reply action and public tree rendering**

Add a reply action/modal to `CommentsResource`. In `PostComments.vue`, show avatar/Gravatar, display name, badge chips, timestamp, optional browser/OS, safe website link, reply button, and an inline composer. Use responsive indentation and visible empty/loading/error/pending states.

- [ ] **Step 5: Add E2E coverage and run verification**

Run: `npm test -- --run tests/unit/comment-reply.test.ts`; `npx playwright test tests/e2e/comments.spec.ts`; `npm run lint -- --quiet`; `npm run typecheck`.

```bash
git add server/api/admin/comments/[id]/reply.post.ts server/modules/comments/comment.service.ts app/modules/comments/admin/CommentsResource.ts app/components/public/PostComments.vue shared/schemas/comment.ts app/admin/i18n/index.ts tests/unit/comment-reply.test.ts tests/e2e/comments.spec.ts
git commit -m "feat: add administrator comment replies"
```

### Task 5: Unify author card and redesign public profile

**Files:**
- Modify: `shared/schemas/author-card.ts`
- Modify: `app/components/public/AuthorCardView.vue`
- Create: `app/components/public/ProfileHero.vue`
- Create: `app/components/public/ProfileProjectCard.vue`
- Modify: `app/pages/profile.vue`
- Modify: `server/modules/profile/profile.service.ts`
- Modify: `server/modules/profile/profile.runtime.service.ts`
- Modify: `app/admin/i18n/index.ts`
- Test: `tests/unit/author-card-view.test.ts`, `tests/e2e/profile.spec.ts`

**Interfaces:**
- Consumes: existing profile translations and sidebar `ResolvedAuthorCard`.
- Produces: `AuthorCardVariant = 'sidebar' | 'article' | 'profileHero'`, `resolvePublicAuthorCard(input: AuthorCardSource): ResolvedAuthorCard`, `buildVisibleProfileSections(input): ProfileSection[]`, and `ProfileHero`/`ProfileProjectCard` props that contain only public profile data.

```ts
interface AuthorCardSource { displayName: string, profilePath: string, headline?: string, bio?: string, avatar?: { url: string, alt: string } | null, socials?: AuthorSocial[] }
interface ProfileSection { type: string }
```

- [ ] **Step 1: Write failing View Model and layout tests**

```ts
it('adds a safe site-relative profile URL to the author card', () => {
  expect(resolvePublicAuthorCard({ displayName: 'Lee', profilePath: '/profile' }).profileUrl).toBe('/profile')
})

it('does not render an empty profile section', () => {
  expect(buildVisibleProfileSections({ sections: [{ type: 'about' }], bio: '' })).toEqual([])
})
```

- [ ] **Step 2: Run focused tests and verify failure**

Run: `npm test -- --run tests/unit/author-card-view.test.ts`

Expected: FAIL because the variant contract and public profile composition are not implemented.

- [ ] **Step 3: Extend the author card contract**

Add `variant` and `profileUrl` without changing existing sidebar props. The server resolves the profile path as a relative path. Validate social links before returning them.

- [ ] **Step 4: Implement the public profile composition**

Build a hero with identity, intro, social channels and CTAs; use project cards with real media first and the stable constructed placeholder second; render enabled profile sections in configured order and omit empty sections. Use desktop two-column layout and mobile single-column layout.

- [ ] **Step 5: Reuse the card in the sidebar and preserve bilingual content**

Keep one backend author-card source. Pass `variant="sidebar"` from `SidebarCards.vue`; the profile hero consumes translated profile data and exposes only localized public fields.

- [ ] **Step 6: Run browser verification and commit**

Run: `npm test -- --run tests/unit/author-card-view.test.ts`; `npx playwright test tests/e2e/profile.spec.ts`; `npm run lint -- --quiet`; `npm run typecheck`.

```bash
git add shared/schemas/author-card.ts app/components/public/AuthorCardView.vue app/components/public/ProfileHero.vue app/components/public/ProfileProjectCard.vue app/pages/profile.vue server/modules/profile app/admin/i18n/index.ts tests/unit/author-card-view.test.ts tests/e2e/profile.spec.ts
git commit -m "feat: redesign public profile and shared author card"
```

### Task 6: Optimize article detail and make locale navigation consistent

**Files:**
- Modify: `shared/types/post.ts`
- Modify: `server/modules/posts/post.service.ts`
- Modify: `server/api/public/posts/[alias].get.ts`
- Modify: `app/pages/posts/[alias].vue`
- Modify: `app/components/public/PostDetail.vue`
- Create: `app/components/public/ArticleHeader.vue`
- Create: `app/components/public/ArticleAuthorCard.vue`
- Create: `app/components/public/LocalizedBreadcrumbs.vue`
- Modify: `shared/utils/locale-navigation.ts`
- Modify: `app/components/public/LanguageSwitcher.vue`
- Modify: `app/admin/i18n/index.ts`
- Test: `tests/unit/locale-navigation.test.ts`, `tests/unit/public-post-view.test.ts`
- Test: `tests/e2e/post-locales.spec.ts`

**Interfaces:**
- Consumes: `getPublicPostByAlias(localeCode,alias,user)`, post translation rows, `ResolvedAuthorCard`, locale registry.
- Produces: `PublicPostDetail.localizedAliases`, `localizedPostPath({ locale, alias })`, `publicPostView(input): PublicPostDetail`, `ArticleAuthorCard` with `variant="article"`, and a locale-consistent public post View Model.

- [ ] **Step 1: Write failing locale and View Model tests**

```ts
it('switches to the same post translated alias instead of reusing the current alias', () => {
  expect(localizedPostPath({ locale: 'en', alias: 'nuxt4-blog-start-en' })).toBe('/posts/nuxt4-blog-start-en?locale=en')
})

it('keeps article author data in the public View Model', () => {
  expect(publicPostView({ author: { name: 'Lee', profileUrl: '/profile', socials: [] } }).author.profileUrl).toBe('/profile')
})
```

- [ ] **Step 2: Run focused tests and verify failure**

Run: `npm test -- --run tests/unit/locale-navigation.test.ts tests/unit/public-post-view.test.ts`

Expected: FAIL because localized post alias metadata and article author View Model are not present.

- [ ] **Step 3: Add locale-aware post metadata**

Extend the public post result with the available translation aliases and the resolved author card. The service must query the requested locale explicitly and mark missing translations instead of mixing fields from another language.

- [ ] **Step 4: Implement shared article components**

Move title/summary/meta/cover into `ArticleHeader.vue`; move author identity into `ArticleAuthorCard.vue`; move breadcrumb links into `LocalizedBreadcrumbs.vue`. On desktop render a reading column plus TOC/context column; on mobile collapse the TOC.

- [ ] **Step 5: Update every internal post link**

Use `localizedPostPath` for language switching, categories, tags, related posts, previous/next posts, author CTA and article breadcrumbs. Add `lang`, canonical, hreflang and JSON-LD `author.url` from the resolved locale and profile path.

- [ ] **Step 6: Run E2E and full verification**

Run: `npm test -- --run tests/unit/locale-navigation.test.ts tests/unit/public-post-view.test.ts`; `npx playwright test tests/e2e/post-locales.spec.ts`; `npm run lint`; `npm run typecheck`.

```bash
git add shared/types/post.ts server/modules/posts/post.service.ts server/api/public/posts/[alias].get.ts app/pages/posts/[alias].vue app/components/public/PostDetail.vue app/components/public/ArticleHeader.vue app/components/public/ArticleAuthorCard.vue app/components/public/LocalizedBreadcrumbs.vue shared/utils/locale-navigation.ts app/components/public/LanguageSwitcher.vue app/admin/i18n/index.ts tests/unit/locale-navigation.test.ts tests/unit/public-post-view.test.ts tests/e2e/post-locales.spec.ts
git commit -m "feat: unify multilingual article reading experience"
```

### Task 7: Final integration, migration, privacy, and release gate

**Files:**
- Modify: `server/repositories/migrations/meta/_journal.json`
- Modify: `docs/phases/P01-authentication-users.md`
- Modify: `docs/phases/P07-comments.md`
- Create: `docs/adr/0005-public-identity-and-comment-privacy.md`
- Test: `tests/e2e/auth-account-comments-profile.spec.ts`

**Interfaces:**
- Consumes: all contracts from Tasks 1–6.
- Produces: one end-to-end acceptance path with MySQL migration, permissions, public localization, comment privacy and rollback notes.

```ts
async function registerAndLogin(page: import('@playwright/test').Page): Promise<void>
async function submitAuthenticatedComment(page: import('@playwright/test').Page, input: { alias: string }): Promise<void>
```

- [ ] **Step 1: Write the integration test matrix**

```ts
test('registers, comments, receives badge, and sees localized profile/article views', async ({ page }) => {
  await registerAndLogin(page)
  await submitAuthenticatedComment(page, { alias: 'nuxt4-blog-start' })
  await expect(page.getByRole('status')).toContainText('待审核')
  await page.goto('/profile?locale=en')
  await expect(page.locator('main')).toBeVisible()
})
```

- [ ] **Step 2: Run the integration test before final cleanup**

Run: `npx playwright test tests/e2e/auth-account-comments-profile.spec.ts`

Expected before final fixes: failures identify contract wiring, permission, migration or locale-link issues; fix the implementation and keep this test as the release guard.

- [ ] **Step 3: Verify migration and privacy behavior against Laragon MySQL**

Run the migration in a disposable test database, repeat it to confirm idempotence, verify existing users/comments remain readable, and confirm a public comment response contains no email, raw IP or raw User-Agent.

- [ ] **Step 4: Update phase records and ADR**

Record actual endpoints, migration number, settings, privacy retention, rollback procedure and any external Turnstile credential requirement. Do not mark external Turnstile success as verified without a configured test site key/secret.

- [ ] **Step 5: Run the complete quality gate**

Run:

```bash
npm run lint
npm run typecheck
npm test -- --run
npm run build
npx playwright test
git diff --check
```

Expected: all commands exit 0. Existing warnings about large chunks or dependency deprecations may remain, but new errors must be fixed before release.

- [ ] **Step 6: Commit the integration task**

```bash
git add server/repositories/migrations/meta/_journal.json docs/phases/P01-authentication-users.md docs/phases/P07-comments.md docs/adr/0005-public-identity-and-comment-privacy.md tests/e2e/auth-account-comments-profile.spec.ts
git commit -m "test: verify public identity and comment experience"
```

## Delivery order and checkpoints

Execute Tasks 1–2 first so every subsequent public identity View Model has a stable user/badge source. Execute Tasks 3–4 next because comment data and permissions must be stable before the UI redesign. Execute Tasks 5–6 after the data contracts exist. Task 7 is the only release gate.

After each task, inspect `git diff`, run that task's focused tests, and ensure no existing worktree changes were overwritten. Do not remove legacy `BLOG_DB_*` or database adapters as part of this plan; the current project remains MySQL-only until a separately approved database migration plan is completed.
