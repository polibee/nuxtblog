# Root Page Routes and Default Pages Implementation Plan

**Goal:** Publish managed pages at `/{alias}` with legacy `/pages/{alias}` compatibility and modern default about/legal page presentations.

**Architecture:** Keep the existing root catch-all page as the canonical public page renderer, change page URL generation to root paths, and make the legacy namespace redirect to the canonical route. Add a small page-template presentation layer keyed by the persisted page template/alias; default content remains database seed data and editable in the admin.

**Spec:** Approved design in the preceding conversation.

### Task 1: Canonical page URLs and redirects

- Modify `server/utils/contentUrl.ts` so page URLs resolve to `/{alias}`.
- Modify `app/pages/pages/[alias].vue` to issue a 301 redirect to the localized root URL while preserving the alias.
- Keep `app/pages/[slug].vue` as the root page resolver and preserve post collision handling.
- Update page preview, sitemap, public navigation and tests to assert root URLs.

### Task 2: Default page content and templates

- Update `server/modules/pages/default-pages.ts` with independent, editable sample content for About, Privacy Policy and Terms of Use.
- Add a persisted template discriminator for the three default pages (`about`, `privacy`, `terms`) while retaining `default` for ordinary pages.
- Update `app/components/public/PageDetail.vue` with isolated visual variants for those templates; ordinary pages keep the generic renderer.
- Keep all default copy in seed data and route visible strings through the existing i18n system where UI labels are introduced.

### Task 3: Verification

- Add unit coverage for canonical page URLs and legacy redirects.
- Run `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`.
- Verify `/about`, `/privacy-policy`, `/terms-of-use`, `/pages/about`, and `/en/about` through the running local server.
