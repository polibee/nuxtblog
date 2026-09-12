# User Session Locale Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the first batch of runtime User, Session, and Locale dependencies on the MySQL-only repository while preserving MySQL/PostgreSQL/Supabase switching through `DB_DRIVER` and `DATABASE_URL`.

**Architecture:** Keep services dependent on repository contracts and a single domain database context. Provide MySQL and PostgreSQL Drizzle schema bundles behind the same service-facing operations; PostgreSQL writes use `returning()`, MySQL writes use `insertId`. Runtime readiness and locale lookup must follow the selected adapter.

**Tech Stack:** Nuxt 4, Nitro/H3, TypeScript, Drizzle ORM, mysql2, node-postgres, Vitest, Supabase PostgreSQL.

**Spec:** `docs/superpowers/specs/2026-09-12-localization-profile-alias-audit-design.md`

## Global Constraints

- Data access remains inside repositories/services; API handlers do not issue SQL.
- `DB_DRIVER/DATABASE_URL` take precedence over `BLOG_DB_*` during migration.
- Remote PostgreSQL/Supabase uses SSL and never silently falls back to memory.
- Existing user changes in the dirty worktree must be preserved.
- Every migrated write path has a MySQL and PostgreSQL test.

---

### Task 1: Domain context contract

**Files:**
- Create: `server/repositories/domain-context.ts`
- Test: `tests/unit/domain-context.test.ts`

- [ ] Write failing tests for selected driver and readiness delegation.
- [ ] Implement `DomainRepositoryContext` with driver, `mysql`, `postgres`, and `isReady` accessors.
- [ ] Run `npm test tests/unit/domain-context.test.ts -- --run`.

### Task 2: Locale repository adapter completion

**Files:**
- Modify: `server/repositories/locale.repository.ts`
- Modify: `server/repositories/locale.postgres.repository.ts`
- Modify: `server/repositories/locale.runtime.repository.ts`
- Test: `tests/unit/locale-repository.test.ts`

- [ ] Cover list, code lookup, default lookup, insert, update, and delete contracts.
- [ ] Ensure PostgreSQL insert uses `returning()` and MySQL insert uses `insertId`.
- [ ] Route all locale calls through the selected context.
- [ ] Run focused tests and typecheck.

### Task 3: User and session adapters

**Files:**
- Create: `server/repositories/user.postgres.repository.ts`
- Create: `server/repositories/session.postgres.repository.ts`
- Create: `server/repositories/user.runtime.repository.ts`
- Create: `server/repositories/session.runtime.repository.ts`
- Modify: `server/repositories/user.repository.ts`
- Modify: `server/repositories/session.repository.ts`
- Modify: `server/utils/auth.ts`
- Test: `tests/unit/user-session-repository.test.ts`

- [ ] Define equivalent PostgreSQL queries for user lookup/create/update and session create/read/delete.
- [ ] Normalize Date, bigint ID, expiry, and affected-row semantics.
- [ ] Switch auth and password-reset services to runtime repositories.
- [ ] Run authentication regression tests against both adapters.

### Task 4: Database bootstrap and migration verification

**Files:**
- Modify: `server/plugins/blog-db.ts`
- Modify: `server/repositories/domain-status.ts`
- Create: `server/repositories/migrations/0036_user-session-locale-postgres.sql`
- Test: `tests/unit/database-driver-priority.test.ts`

- [ ] Verify `DB_DRIVER/DATABASE_URL` wins over every `BLOG_DB_*` value.
- [ ] Apply/verify PostgreSQL schema and indexes in Supabase.
- [ ] Verify no configured remote database falls back to memory.
- [ ] Run real MySQL and Supabase health plus CRUD checks.

### Task 5: Quality gate and handoff

- [ ] Run `npm run lint -- --quiet`.
- [ ] Run `npm run typecheck`.
- [ ] Run `npm test -- --run`.
- [ ] Run `npm run build` and record any non-zero or non-terminating behavior.
- [ ] Do not remove `BLOG_DB_*` until the next migration batch is complete and all imports are gone.
