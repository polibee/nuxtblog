# Sidebar i18n and Core E2E Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete sidebar author-card localization, add repeatable browser coverage for the five highest-risk public/admin flows, and remove the Nuxt runtime page-meta warning without disturbing existing dirty work.

**Architecture:** Keep ordinary sidebar card translations in `sidebar_card_translations`; add a dedicated translation table for the author card's human-facing fields while retaining shared social links/configuration. Browser tests use the existing local MySQL-backed app and deterministic test fixtures, with external payment/webhook calls mocked at the boundary.

**Tech Stack:** Nuxt 4, Vue 3, TypeScript, Nitro/H3, Drizzle ORM/MySQL, Vitest, Playwright.

**Global Constraints:** Preserve all existing uncommitted changes. Use npm. Do not add a second UI system. All user-facing text goes through i18n. All writes require server authorization and validation. Run lint, typecheck, unit tests, build, and browser smoke tests before delivery.

### Task 1: Localize the sidebar author card

**Files:**
- Create the MySQL migration and schema definitions for `sidebar_author_card_translations`.
- Modify the sidebar author-card repository/service and admin manager.
- Add zh-CN/en translations and focused unit tests.

- [ ] Define the table keyed by `(card_id, locale_id)` with display name, headline, bio, and CTA label.
- [ ] Read/write localized fields by locale code while keeping avatar, layout, social links, and CTA URL shared.
- [ ] Render the current public locale and use the default locale only as an explicit empty-state fallback.
- [ ] Verify create/update/read behavior with unit tests and migration registration.

### Task 2: Add core browser E2E coverage

**Files:**
- Create focused specs under `tests/e2e/` and test helpers under `tests/e2e/support/`.
- Modify package scripts/config only when required for deterministic local execution.

- [ ] Cover login/session and permission gating.
- [ ] Cover navigation CRUD and public header/footer reflection.
- [ ] Cover comment submission and administrator reply.
- [ ] Cover advertising purchase/review/placement with payment boundary mocked.
- [ ] Cover notification channel test and retry state with a controllable webhook boundary.
- [ ] Cover locale switching, localized sidebar cards, and public article rendering.

### Task 3: Remove the Nuxt page-meta warning

**Files:**
- Modify only the page/router boundary that invokes `definePageMeta` dynamically.
- Add a regression test or static check for the supported page-meta placement.

- [ ] Identify the exact runtime call from the dev log.
- [ ] Move metadata into compiler-scanned page components or replace the dynamic call with supported route metadata.
- [ ] Restart the dev server and verify the warning is absent.

### Task 4: Integration review and quality gates

- [ ] Review the combined diff for schema/API/UI contract mismatches.
- [ ] Run `npm run audit:i18n`.
- [ ] Run `npm run lint`.
- [ ] Run `npm run typecheck`.
- [ ] Run `npm test -- --run`.
- [ ] Run `npm run build`.
- [ ] Run the local browser E2E suite and report any environment-limited flows honestly.
