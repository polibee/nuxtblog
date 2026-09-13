# Task 1 implementation report — featured image field contract

## Status

Implemented and verified.

## Implementation commit

- `8b24a88 fix(posts): centralize featured image input`

## Changed files

- `shared/schemas/post.ts`
  - Kept the create/update input at the post entity's top-level `featuredMediaId`.
  - Removed `featuredImageId` from translation input and made translation objects strict, so legacy translation IDs cannot enter new writes.
- `server/modules/posts/post.service.ts`
  - Stopped building translation write rows with `featuredImageId`.
- `server/repositories/post.repository.ts`
  - Kept the MySQL read fallback `row.translationFeaturedId ?? row.featuredMediaId`.
  - Documented `translationFeaturedId` as read-only legacy compatibility and preserved its existing per-locale value during translation replacement.
- `server/repositories/post.postgres.repository.ts`
  - Applied the same read-only legacy compatibility behavior for PostgreSQL.
- `server/repositories/post.runtime.repository.ts`
  - Documented the runtime repository contract for the legacy fallback.
- `tests/unit/post-featured-image.test.ts`
  - Added the requested top-level `featuredMediaId` and top-level legacy-key tests, plus a regression test that rejects nested translation `featuredImageId` writes.

## Test-first evidence

Before implementation, the new nested legacy-write regression test failed as expected:

```text
Test Files  1 failed (1)
Tests  1 failed | 2 passed (3)
AssertionError: expected [Function] to throw an error
```

## Verification

Command:

```text
npm test -- --run tests/unit/post-featured-image.test.ts tests/unit/post-excerpt.test.ts
```

Output:

```text
Test Files  2 passed (2)
Tests  5 passed (5)
Duration  193ms
```

Command:

```text
npm run lint -- --quiet
```

Output:

```text
> lint
> eslint . --quiet
```

Exit code: `0`.

## Concerns

- The existing `post_translations.featured_image_id` database column remains intentionally present for legacy reads. It is no longer accepted from new post input, while public `coverUrl` continues to use the required legacy-first fallback.
- The workspace contains extensive unrelated user changes; the implementation commit contains only the six Task 1 files listed above. This report is committed separately so it can record the immutable implementation commit hash.

## Fix round 1

Review findings addressed:

- Replaced broad translation `.strict()` with `featuredImageId: z.never().optional()`. Existing unknown translation fields continue to be stripped, while the legacy featured-image key is rejected.
- Added MySQL repository-level regression tests for retaining `post_translations.featured_image_id` during translation replacement and for the legacy-first public cover mapping.

Fix commit:

- `ca06b3d fix(posts): narrow featured image schema contract`

Covering test command:

```text
npm test -- --run tests/unit/post-featured-image.test.ts tests/unit/post-repository-featured-image.test.ts tests/unit/post-excerpt.test.ts
```

Output:

```text
Test Files  3 passed (3)
Tests  8 passed (8)
Duration  567ms
```

Lint command:

```text
npm run lint -- --quiet
```

Output:

```text
> lint
> eslint . --quiet
```

Exit code: `0`.

Fix-round concerns:

- Repository tests use the existing unit-test Vitest mocking style with a deterministic MySQL repository double; they do not require a live database.
- Existing unrelated working-tree changes remain untouched and uncommitted.

## Fix round 3

Review findings addressed:

- Added explicit `translationFeaturedId: 11` priority assertions for both the MySQL and PostgreSQL alias lookups.
- Changed the published-row fixture to a factory and rebuilds it in `beforeEach`, so each test starts with the default legacy cover `11` and no test depends on execution order.

Fix commit:

- `9b2ae4a test(posts): isolate featured image alias fixtures`

Covering test and lint commands:

```text
npm test -- --run tests/unit/post-featured-image.test.ts tests/unit/post-repository-featured-image.test.ts tests/unit/post-excerpt.test.ts
npm run lint -- --quiet
```

Output:

```text
Test Files  3 passed (3)
Tests  13 passed (13)
Duration  759ms

> lint
> eslint . --quiet
```

Both commands exited with code `0`.

Fix-round-3 concerns:

- Changes are test-only; production code and the featured-image contract were not modified.
- Existing unrelated working-tree changes remain untouched and uncommitted.

## Fix round 2

Review finding addressed:

- Expanded repository-level coverage for `translationFeaturedId: null` falling back to `featuredMediaId` (`22`) in the MySQL list path and MySQL alias lookup (`findPublishedByAlias`).
- Added equivalent PostgreSQL alias-path coverage using the independent PostgreSQL repository implementation.
- No production contract or mapping behavior was changed.

Fix commit:

- `fb85d95 test(posts): cover featured image fallback paths`

Covering test and lint commands:

```text
npm test -- --run tests/unit/post-featured-image.test.ts tests/unit/post-repository-featured-image.test.ts tests/unit/post-excerpt.test.ts
npm run lint -- --quiet
```

Output:

```text
Test Files  3 passed (3)
Tests  11 passed (11)
Duration  763ms

> lint
> eslint . --quiet
```

Both commands exited with code `0`.

Fix-round-2 concerns:

- Repository coverage uses deterministic MySQL and PostgreSQL database mocks; no live database was required.
- Existing unrelated working-tree changes remain untouched and uncommitted.
