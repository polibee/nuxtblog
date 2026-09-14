# Alias Display, Article Embed and Reading Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify Alias-based multilingual display labels and improve public article image/embed rendering without coupling article translations.

**Architecture:** Add a pure shared label resolver for all resource/navigation DTOs, then make navigation and resource presentation call it. Add a server-side article content normalizer for Markdown/HTML/BBCode images and safe links, followed by scoped article-body CSS and a client-side lightbox. Keep article title/body/excerpt translations independent.

**Tech Stack:** Nuxt 4, Vue 3, TypeScript, Nitro/H3, Drizzle repositories, Zod/sanitization, Vitest, Tailwind CSS.

**Spec:** `docs/superpowers/specs/2026-09-13-alias-display-label-design.md`

## Global Constraints

- Use npm and keep `package.json` / `package-lock.json` unchanged unless a dependency is strictly required.
- Use `apply_patch` for source edits and preserve all existing worktree changes.
- Keep database access inside repositories/services; client code must not access the database.
- Article translations remain independent; Alias fallback applies to labels, not article titles or content.
- External images and links must be HTTPS or safe site-relative URLs; no arbitrary iframe embeds.
- Run `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build` before delivery.

---

### Task 1: Shared display-label contract

**Files:**
- Create: `shared/utils/display-label.ts`
- Create: `tests/unit/display-label.test.ts`

**Interfaces:**
- Produces `resolveDisplayLabel(input: { locale: string, defaultLabel: string, localizedLabel?: string | null, alias?: string | null, systemKey?: string | null, defaultLocale?: string }): string`.

- [ ] **Step 1: Write failing tests** for Chinese precedence, English localized precedence, English Alias fallback, system-key fallback, whitespace trimming, and non-empty output.
- [ ] **Step 2: Run `npm test -- --run tests/unit/display-label.test.ts` and confirm the new contract fails before implementation.**
- [ ] **Step 3: Implement the pure resolver with the order `localizedLabel → alias → systemKey → defaultLabel` for non-default locales and `defaultLabel → alias → systemKey` for the default locale.**
- [ ] **Step 4: Run the focused test and confirm it passes.**

### Task 2: Navigation label and locale fallback

**Files:**
- Modify: `server/modules/navigation/navigation.service.ts`
- Modify: `server/repositories/navigation.repository.ts`
- Modify: `server/repositories/navigation.postgres.repository.ts`
- Modify: `app/modules/navigation/admin/NavigationItemPicker.vue`
- Create/modify: `tests/unit/navigation-label.test.ts`

**Interfaces:**
- Consumes `resolveDisplayLabel` from Task 1.
- Produces public navigation labels that never use raw URLs and use target Alias when English text is absent.

- [ ] **Step 1: Add failing tests for an English navigation item with an empty localized label, expecting its target Alias, and for a group expecting its stable key.**
- [ ] **Step 2: Trace the current item translation and target lookup path and run the focused test to capture the current failure.**
- [ ] **Step 3: Pass `alias`/`systemKey` into the resolver in `resolveItem`; preserve resolved URLs separately. Ensure custom links use their configured label or stable key, never URL text.**
- [ ] **Step 4: Keep the existing fixed parent-ID copy repair and add a regression assertion that copied footer children retain their group parent.**
- [ ] **Step 5: Update picker hints so English labels are explicitly optional and Alias fallback is explained through i18n text.**
- [ ] **Step 6: Run navigation tests and inspect `/api/public/navigation?location=footer&locale=en`.**

### Task 3: Resource-level Alias fallback

**Files:**
- Modify: `app/admin/i18n/index.ts`
- Modify: resource definitions under `app/modules/**/admin/*Resource.ts`
- Modify: relevant server DTO/resource mapping in `server/utils/resourceConfigs.ts` and module services
- Create/modify: `tests/unit/resource-display-label.test.ts`

**Interfaces:**
- Consumes `resolveDisplayLabel` from Task 1.
- Produces consistent display labels for pages, taxonomy, settings, commerce, advertising, media, and system resources.

- [ ] **Step 1: Inventory existing fallback expressions with `rg` and add regression cases for page/category/system resource labels.**
- [ ] **Step 2: Replace only user-visible label fallback expressions with the shared resolver; keep article title/content fields untouched.**
- [ ] **Step 3: Make English fields optional in UI schema descriptions and add translated helper text, without changing persisted article translation requirements.**
- [ ] **Step 4: Run focused tests and verify existing resource routes still use stable slugs and permissions.**

### Task 4: Article content normalization and safety

**Files:**
- Create: `shared/utils/article-embed.ts`
- Modify: `server/utils/sanitize.ts`
- Modify: `server/modules/posts/post.service.ts`
- Modify: `app/pages/posts/[alias].vue`
- Create: `tests/unit/article-embed.test.ts`

**Interfaces:**
- Produces `normalizeArticleEmbeds(content: string): string` for Markdown image, HTML `img`, BBCode image, and safe ordinary links.

- [ ] **Step 1: Write failing tests for all three image syntaxes, HTTPS/site-relative acceptance, `javascript:`/`data:` rejection, and ordinary link preservation.**
- [ ] **Step 2: Run the focused tests and confirm failure.**
- [ ] **Step 3: Implement a bounded parser/normalizer that does not execute arbitrary HTML, then pass output through the existing whitelist sanitizer.**
- [ ] **Step 4: Apply normalization to public article content at the server boundary and keep paid-content handling within the same safety boundary.**
- [ ] **Step 5: Run security-focused unit tests and verify no raw unsafe protocol survives.**

### Task 5: Article detail reading layout and image preview

**Files:**
- Modify: `app/components/public/PostDetail.vue`
- Modify: `app/pages/posts/[alias].vue`
- Create/modify: `tests/unit/post-detail-view.test.ts`

**Interfaces:**
- Consumes normalized article HTML from Task 4.
- Produces scoped `.article-prose` image/link presentation and an accessible image lightbox.

- [ ] **Step 1: Add a component regression test that confirms the excerpt is not rendered below the title.**
- [ ] **Step 2: Add scoped styles: content images max-width 100%, intrinsic ratio, bounded height with contain, mobile width 100%, and no horizontal overflow.**
- [ ] **Step 3: Add click/keyboard preview behavior for content images only; keep featured image and author/sidebar components isolated.**
- [ ] **Step 4: Verify reduced-motion and focus-visible behavior.**
- [ ] **Step 5: Run component tests and manually inspect desktop/mobile article pages.**

### Task 6: Full verification and documentation update

**Files:**
- Modify: `docs/superpowers/specs/2026-09-13-alias-display-label-design.md` only if implementation decisions materially differ.

- [ ] **Step 1: Run `npm run lint`.**
- [ ] **Step 2: Run `npm run typecheck`.**
- [ ] **Step 3: Run `npm test`.**
- [ ] **Step 4: Run `npm run build` and wait for process completion.**
- [ ] **Step 5: Validate Chinese and English navigation, an independent English/Chinese article, image Embed, and the article detail layout through the running local site.**
- [ ] **Step 6: Report changed files, test results, existing warnings, and any unverified production-only external image behavior.**
