# Content, Media and Advertising Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Restore article view metrics, modernize media category management, seed reusable ad slots, and expose the public advertising purchase flow through navigation.

**Architecture:** Keep public post DTOs as the source for card metrics, with views and approved comments rendered as separate metadata values. Keep media folder CRUD and media-folder relation intact while changing only the management presentation. Reuse the existing advertising campaign/order/payment services; add idempotent slot discovery and navigation registration instead of a parallel purchase system.

**Tech Stack:** Nuxt 4, Vue 3, TypeScript, Tailwind CSS v4, Lucide, Nitro/H3, Drizzle ORM, Laragon MySQL.

**Spec:** Approved design in chat on 2026-09-13.

## Global Constraints

- Preserve existing user changes and edit only files required for this scope.
- Use existing admin resources, i18n, permissions, repositories, and advertising services.
- Do not expose arbitrary JavaScript advertising creatives; keep material validation server-side.
- Default ad slots are idempotent and never overwrite administrator edits.
- Run `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build` before delivery.

### Task 1: Restore article metrics

**Files:**
- Modify: `app/components/public/PostList.vue`
- Modify: `server/modules/posts/post.service.ts`
- Modify: `shared/types/post.ts`
- Test: existing post/public API tests where available

**Interfaces:**
- Consume `PublicPostSummary.views` and `commentCount`.
- Produce a stable card metadata row showing author, reading time, views, and comments; zero values remain visible.

- [ ] Confirm the API still maps `views` from analytics and `commentCount` from approved comments.
- [ ] Render eye and comment icons with localized labels, including zero values.
- [ ] Preserve list/grid layout and add no new database path.
- [ ] Run focused post tests and inspect the public posts response.

### Task 2: Modernize media categories

**Files:**
- Modify: `app/modules/media/admin/MediaLibraryPage.vue`
- Modify: `app/admin/i18n/index.ts`

**Interfaces:**
- Consume existing `folders`, `folderFilter`, `setFolder`, rename, delete, and create handlers.
- Produce desktop category cards/panel and mobile horizontal category navigation without changing folder API contracts.

- [ ] Replace the plain text category list with compact icon/stat cards for all, uncategorized, and folders.
- [ ] Keep rename/delete actions keyboard accessible and visually secondary.
- [ ] Add responsive mobile overflow behavior and preserve the current filter selection.
- [ ] Verify folder counts and media filtering after create, rename, delete, and selection.

### Task 3: Default advertising slots and purchase discovery

**Files:**
- Modify: `app/modules/advertising/constants/ad-slots.ts`
- Modify: `server/modules/advertising/ad-seed.service.ts`
- Modify: `app/pages/advertising.vue`
- Modify: `app/admin/i18n/index.ts`
- Modify: navigation discovery/seed files identified by `rg "ensureDefaultNavigations|advertising" server/modules/navigation app/modules/navigation`

**Interfaces:**
- Consume `AD_SLOTS`, existing advertising purchase APIs, campaign/order/payment service, and public navigation resolver.
- Produce idempotent common slots, a usable localized purchase page, and one canonical `/advertising` navigation item.

- [ ] Extend the slot catalog with home feed, post top, post bottom, and footer positions while retaining sidebar and custom-slot support.
- [ ] Ensure boot seed inserts missing slots only and does not overwrite custom names, status, or pricing.
- [ ] Verify `/advertising` displays selectable slots, dates, budget, material fields, validation state, and order status.
- [ ] Keep text/link/image materials supported and reject unsafe script material with a clear localized error.
- [ ] Register the page in public navigation discovery with Chinese/English labels and deduplicate by canonical path.
- [ ] Verify approved purchases create the existing order/payment linkage and placements.

### Task 4: Verification and regression review

**Files:**
- Modify only if a failing regression test identifies a scoped defect.
- Test: relevant `tests/unit/**` and `tests/e2e/**`

- [ ] Test article cards with views > 0, views = 0, comments > 0, and comments = 0.
- [ ] Test media folder operations and responsive rendering through the running app.
- [ ] Test default slot idempotency, purchase validation, and navigation deduplication.
- [ ] Run the complete quality gate commands and report warnings separately from failures.

### Task 5: Campaign management and delivery association

**Files:**
- Modify: `app/modules/advertising/admin/CampaignsManagerPage.vue`
- Modify: `app/modules/advertising/admin/AdCreativesResource.ts`
- Modify: `app/modules/advertising/admin/AdPlacementsResource.ts`
- Modify: `server/api/admin/advertising/campaigns/index.get.ts`
- Modify: `server/api/admin/advertising/creatives/index.get.ts`

**Association contract:**

```text
public advertising form
  → ad_campaigns.material_*
  → payment fulfillment / review
  → ad_creatives + ad_creative_translations
  → ad_placements + ad_slots
  → public resolver / impression & click metrics
```

- The campaign list/detail view must expose the submitted material as the review source of truth, including image, target URL, title, description, contact email, slot and price snapshot.
- Campaign details must show linked creatives and placements, with links to their dedicated management resources.
- Creative and placement resources must expose their campaign relationship; placement editing uses a campaign relation selector instead of a free-form numeric ID.
- Campaign metrics are aggregated from all creatives linked to the campaign; CTR is derived from impressions and clicks and never stored as a duplicated value.
- The review switch controls whether paid campaigns enter `pending_review` or are automatically approved and placed. Purchase events are written to the notification outbox; delivery requires an administrator subscription and configured channel.

- [ ] Verify a front-end purchase material is visible unchanged in the campaign detail drawer.
- [ ] Verify approval creates/links creative translation and placement, and both appear in campaign details.
- [ ] Verify pause/resume changes delivery status and public resolution respects the placement state.
- [ ] Verify impression/click counters aggregate correctly and CTR handles zero impressions.

## Self-review

- Article views are explicitly preserved and independently rendered from comments.
- Media folder APIs and media relations remain unchanged; only presentation is redesigned.
- Advertising purchase uses existing order/payment services and does not create a second billing path.
- Navigation registration is canonical-path based, preventing the reported duplicate menu entry.
