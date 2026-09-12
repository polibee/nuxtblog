# Database ORM Compatibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the server database layer switchable between memory, MySQL, PostgreSQL, and Supabase through Drizzle ORM without exposing driver details to domain services.

**Architecture:** A single database factory owns driver selection, connection lifecycle, migrations, and transactions. Domain repositories expose stable contracts and receive a typed database context; service and API layers never create pools or import driver-specific Drizzle packages.

**Tech Stack:** Nuxt 4, Nitro/H3, TypeScript, Drizzle ORM, mysql2, pg, Vitest, Supabase PostgreSQL.

**Spec:** `docs/superpowers/specs/2026-09-12-localization-profile-alias-audit-design.md`

## Global Constraints

- Preserve existing user changes and do not reset or clean the dirty worktree.
- Keep the current MySQL runtime behavior working while introducing the adapter boundary.
- Use parameterized Drizzle queries; never interpolate user input into SQL.
- Keep secrets out of logs and client bundles.
- `DB_DRIVER=memory` is the only implicit local data source; configured remote drivers fail closed unless `ALLOW_MEMORY_FALLBACK=true`.
- Every production behavior change gets a failing unit or contract test before implementation.

---

### Task 1: Database configuration and ORM factory

**Files:**
- Create: `server/database/types.ts`
- Create: `server/database/config.ts`
- Create: `server/database/factory.ts`
- Create: `server/database/lifecycle.ts`
- Modify: `server/utils/runtimeConfig.ts`
- Modify: `server/repositories/db.server.ts`
- Test: `tests/unit/database-config.test.ts`

**Interfaces:**
- `DatabaseDriver = 'mysql' | 'postgres' | 'supabase'`
- `DatabaseConfig` contains driver, URL, SSL, pool limits, and fallback policy.
- `createDatabaseClient(config)` returns a typed Drizzle client and close callback.
- `getDatabase()` returns the initialized ORM context; no repository creates a pool.

- [x] Write failing tests for driver normalization, Supabase URL handling, secret-free logging metadata, and fallback policy.
- [x] Run `npm test tests/unit/database-config.test.ts -- --run` and confirm the expected failures.
- [x] Implement config normalization and the factory using `mysql2/promise` and `pg` behind one module boundary; PostgreSQL schema/migration wiring remains gated on the PostgreSQL schema bundle.
- [x] Move migration/seed/close lifecycle into `server/database/lifecycle.ts` while retaining the existing MySQL migration path.
- [x] Run the focused test, then `npm run typecheck`.

### Task 2: Repository contracts and transaction context

**Files:**
- Create: `server/database/transaction.ts`
- Create: `server/repositories/contracts/page.repository.ts`
- Create: `server/repositories/contracts/profile.repository.ts`
- Create: `server/repositories/contracts/post.repository.ts`
- Create: `server/repositories/contracts/index.ts`
- Modify: `server/repositories/page.repository.ts`
- Modify: `server/repositories/post.repository.ts`
- Modify: `server/modules/pages/page.service.ts`
- Modify: `server/modules/profile/profile.service.ts`
- Test: `tests/unit/repository-contracts.test.ts`

**Interfaces:**
- Repositories accept `TransactionContext` for writes and return domain records, not Drizzle rows.
- `PageRepository.findPublishedByAlias({ localeId, alias })` remains the public lookup contract.
- `ProfileRepository.getPublicProfile({ localeId, fallbackLocaleId })` is locale-aware.

- [ ] Write contract tests for CRUD, alias lookup, transaction rollback, and locale fallback.
- [ ] Verify the tests fail against the current direct `getDb()` implementation.
- [x] Introduce the initial Page/Post/Profile/Alias/localized-settings contracts; repository registry injection remains the next integration step.
- [ ] Adapt existing MySQL Drizzle repositories to implement contracts without changing API response shapes.
- [ ] Run focused contract tests and existing repository-related tests.

### Task 3: Dialect-safe schema and migrations

**Files:**
- Create: `server/database/schema/mysql/index.ts`
- Create: `server/database/schema/postgres/index.ts`
- Create: `server/database/migrations/mysql/README.md`
- Create: `server/database/migrations/postgres/README.md`
- Modify: `drizzle.config.ts`
- Modify: `server/repositories/schema/*.ts` as each domain is migrated
- Test: `tests/unit/database-schema-policy.test.ts`

- [ ] Add tests rejecting MySQL-only migration selection for PostgreSQL/Supabase and rejecting unknown drivers.
- [x] Implement the initial driver-specific PostgreSQL schema bundle and config-driven Drizzle Kit selection.
- [x] Port the first shared core tables: locales, settings, localized settings, redirects, pages, posts, and profile translations; remaining domain tables are still on the legacy MySQL bundle.
- [ ] Keep dialect-specific expressions inside schema/adapter modules; no service-level driver branches.
- [x] Generate and inspect the checked-in PostgreSQL core migration and apply it to the configured Supabase project; remaining domain migrations still require staged porting.

### Task 4: Modular UI i18n and localized Profile

**Files:**
- Create: `app/admin/i18n/core/{zh-CN,en-US}.ts`
- Create: `app/admin/i18n/modules/profile/{zh-CN,en-US}.ts`
- Create: `app/admin/i18n/modules/pages/{zh-CN,en-US}.ts`
- Create: `app/admin/i18n/modules/settings/{zh-CN,en-US}.ts`
- Modify: `app/admin/i18n/index.ts`
- Modify: `server/repositories/schema/profile.ts`
- Modify: `server/modules/profile/profile.service.ts`
- Modify: `app/pages/profile.vue`
- Modify: `app/modules/author/admin/ProfileManagerPage.vue`
- Test: `tests/unit/i18n-modules.test.ts`

- [ ] Add failing tests for module key collision, missing fallback, and Profile locale read/write.
- [ ] Split UI dictionaries by module while preserving the Translator API.
- [ ] Add Profile translation tables and locale-aware service methods.
- [ ] Add locale tabs, translation status, and fallback indicators to the admin editor.
- [ ] Verify `/profile` and locale-prefixed profiles through API and browser tests.

### Task 4A: Locale-aware article publishing

**Files:**
- Modify: `server/repositories/schema/posts.ts`
- Modify: `server/repositories/post.repository.ts`
- Modify: `server/modules/posts/post.service.ts`
- Modify: `server/api/public/posts.get.ts`
- Modify: `server/api/public/posts/[alias].get.ts`
- Modify: `app/modules/posts/admin/PostResource.ts`
- Modify: `app/pages/posts/index.vue`
- Modify: `app/pages/posts/[alias].vue`
- Test: `tests/unit/post-locale-publishing.test.ts`

- [ ] Add failing tests proving a Chinese-only published translation is absent from English lists and an English-only translation is absent from Chinese lists.
- [ ] Add per-translation publication state and query only the requested locale at repository level.
- [ ] Add locale tabs/status indicators in the editor; keep Alias outside translation tabs.
- [ ] Update public links, RSS, Sitemap and language switcher to use the same locale-aware resolver.
- [ ] Verify missing translations do not silently appear in another language.

### Task 5: Alias URL and 301 migration

**Files:**
- Modify: `server/utils/contentUrl.ts`
- Modify: `server/middleware/redirects.ts`
- Modify: `server/modules/pages/page.service.ts`
- Modify: `server/modules/posts/post.service.ts`
- Modify: `app/modules/pages/admin/PageResource.ts`
- Modify: `app/modules/posts/admin/PostResource.ts`
- Remove only after compatibility verification: `app/pages/[slug].vue`
- Test: `tests/unit/content-url.test.ts`
- Test: `tests/unit/redirect-policy.test.ts`

- [ ] Add failing tests for locale-prefixed URLs, alias uniqueness, 301 creation, and redirect-chain compression.
- [ ] Implement one resolver for content URL generation and route parsing.
- [ ] Replace all admin/public `translations[*].slug` reads with Entity alias reads.
- [ ] Add explicit alias-change confirmation text and old/new URL preview in admin forms.
- [ ] Verify old paths return 301 and new paths render the selected locale.

### Task 6: localized settings, cache invalidation, and verification

**Files:**
- Modify: `server/modules/settings/ui.service.ts`
- Modify: `server/api/admin/settings-ui/[page].patch.ts`
- Modify: `app/modules/settings/admin/SettingsWorkspacePage.vue`
- Modify: `server/utils/pageCache.ts`
- Test: `tests/unit/localized-settings.test.ts`
- Test: `tests/e2e/localization-profile-alias.spec.ts`

- [ ] Add failing tests for localized settings read/write, cache invalidation, and secret rejection.
- [ ] Implement locale-aware settings editor and fallback display.
- [ ] Invalidate content, navigation, SEO, Sitemap, RSS, and profile caches after writes.
- [ ] Run `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`.
- [ ] Run browser verification against locale routes and alias redirects; report any database checks blocked by missing Supabase credentials.

## Checkpoints

- Checkpoint A after Task 1: current MySQL startup and all existing tests pass.
- Checkpoint B after Task 2: services use contracts for pages/profile/posts; response shapes remain unchanged.
- Checkpoint C after Task 3: migration selection is explicit and no PostgreSQL path executes MySQL SQL.
- Checkpoint D after Tasks 4–6: localization, Profile, alias redirects, and settings pass automated and browser acceptance.
