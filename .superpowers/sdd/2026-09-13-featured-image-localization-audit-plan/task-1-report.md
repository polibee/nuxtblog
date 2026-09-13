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
