# Localization Audit Fix — Task 2 Report

## Scope

Task 2 only repairs locale bundle completeness, module ownership, and interpolation parity. Public pages, admin pages, audit rules, dynamic-key allowlists, and hardcoded template copy were not changed.

## Files

- `app/i18n/locales/zh-CN/common.ts`
- `app/i18n/locales/en/common.ts`
- `app/i18n/locales/zh-CN/admin.ts`
- `app/i18n/locales/en/admin.ts`
- `tests/unit/i18n-bundles.test.ts`
- `tests/unit/i18n-usage-audit.test.ts`

## TDD evidence

- RED: the new repository coverage test failed on the 125 missing static locale keys; the ownership test failed on the first unowned public profile key. Result: 2 failed, 9 passed.
- GREEN: focused i18n tests passed after the bundle additions. Result: 2 files, 11 tests passed.

## Locale changes

- Added all 125 missing static-call keys to both locales: 37 shared/public/auth/status/draft keys in `common.ts` and 88 framework/widget/resource keys in `admin.ts`.
- Kept existing specialized ownership unchanged for `comments`, `media`, `posts`, and `settings` bundles.
- Added tests that verify every audited static key exists in its owning bundle for both locales.
- Added tests that compare interpolation parameter names across the complete aggregate locales. The zh/en parameter sets are aligned, including `{time}` in `draft.autosavedAt`.
- No cross-bundle duplicate keys were introduced, and no existing compatibility keys were removed. Existing keys that are not visible to the current audit source set remain available for public routes and compatibility.

## Verification

| Command | Result |
| --- | --- |
| `npm test -- --run tests/unit/i18n-bundles.test.ts tests/unit/i18n-usage-audit.test.ts` | PASS — 2 files, 11 tests |
| `npm run audit:i18n` | Expected non-zero — 83 remaining findings: 36 dynamic-key risks and 47 hardcoded template-copy risks; 0 missing-key and 0 locale-difference findings |
| `npm run lint -- --quiet` | PASS |
| `npm run typecheck` | PASS |

The remaining audit findings are intentionally preserved for Task3/Task5. They are in existing public/admin components such as advertising, AI, navigation, notifications, media, slider, dashboard, and admin framework files; this task does not suppress or alter them.
