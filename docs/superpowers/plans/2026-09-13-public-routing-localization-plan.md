# Public Routing and Localization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make public links and locale switching canonical and keep public profile separate from the private account center.

**Architecture:** Use one shared canonical URL builder based on the active locale prefix. Middleware translates legacy query URLs and resume aliases once, while pages and components use the builder for every content link.

**Tech Stack:** Nuxt 4, Vue 3, TypeScript, Nitro middleware, shared pure utilities, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-13-public-routing-localization-design.md`

## Global Constraints

- Keep `/profile` public and `/account` authenticated.
- Default locale has no path prefix; non-default locales use the configured prefix.
- Query locale is compatibility input only.
- Preserve alias 301 behavior and do not change database adapters.

### Task 1: Canonical URL utility and middleware

**Files:**
- Modify: `shared/utils/locale-navigation.ts`
- Modify: `app/middleware/locale.global.ts`
- Test: `tests/unit/locale-navigation.test.ts`

- [ ] Add route-aware helpers that strip legacy locale query parameters, apply the target locale prefix, and preserve non-locale query/hash values.
- [ ] Redirect only legacy query URLs and `/resume`; do not redirect canonical prefixed URLs back to default paths.
- [ ] Add tests for `/posts/a`, `/en/posts/a`, `/posts/a?locale=en`, `/resume`, and query/hash preservation.
- [ ] Run `npm test -- --run tests/unit/locale-navigation.test.ts`.

### Task 2: Use canonical links in public pages

**Files:**
- Modify: `app/components/public/LanguageSwitcher.vue`
- Modify: `app/pages/index.vue`
- Modify: `app/pages/posts/[alias].vue`
- Modify: `app/pages/pages/[alias].vue`
- Modify: `app/pages/profile.vue`
- Test: `tests/unit/locale-navigation.test.ts`

- [ ] Switch languages by navigating to the same pathname with the target prefix and no `locale` query.
- [ ] Replace article breadcrumbs, neighboring posts, related posts, profile links and page links with the shared builder.
- [ ] Keep `/account` outside public content prefixing and preserve its authentication guard.
- [ ] Verify SSR deep links and no redirect loop with `npm run typecheck`.

### Task 3: Regression verification

**Files:**
- Modify: `tests/e2e/**` only if an existing public route suite is present.

- [ ] Run `npm run lint -- --quiet`.
- [ ] Run `npm run typecheck`.
- [ ] Run `npm test -- --run`.
- [ ] Run `npm run build`.
- [ ] Verify HTTP 200/301 behavior against the running dev server for canonical and legacy URLs.
