# Test Data Cleanup Guide

## Purpose

The admin page under **Settings → Database** provides **Clean test data** for development, acceptance testing, and pre-deployment cleanup.

The page shows a preview count first and requires a second confirmation. Both the UI and the API require the `settings.edit` permission.

## Deterministic scope

The current MySQL adapter only matches explicit fixture markers:

- Post aliases: `demo-*` and `pagination-test-*`
- Campaign names: `Demo · *` and `E2E *`
- Creatives, translations, and placements owned by those campaigns
- Comments whose content starts with `E2E ` or whose test email is `e2e@example.com`
- Media whose filename starts with `demo-banner-`

The cleanup does not guess based on age or a title that merely looks like a test. Orders and payment history linked to demo campaigns are retained; the campaign relation is detached so financial audit history is not destroyed.

## Procedure

1. Back up the database, or use a disposable database copy before deployment.
2. Sign in with an administrator account.
3. Open **Settings → Database**.
4. Review the detected counts.
5. Click **Clean detected test data** and confirm.
6. Reload posts, advertising, media, and comments to confirm that real data remains.

## Database compatibility

The cleanup implementation is currently implemented and verified for the Laragon MySQL/MySQL-compatible path only. PostgreSQL/Supabase support is not complete; changing `DB_DRIVER` alone must not be treated as compatibility. On other drivers the endpoint returns a conflict and does not delete anything.

For the current deployment, use MySQL 8+ with `DB_DRIVER=mysql` and `DATABASE_URL`/`DB_*`. Do not connect a public demo site to the production database, payment ledger, or production media bucket.

When PostgreSQL/Supabase support is resumed, it needs a dedicated repository implementation, matching migrations, transaction tests, and cleanup tests before the button can be enabled for that driver.

## Safety boundary

- Keep `SEED_DEMO` disabled for production.
- A cleanup is irreversible; export or back up first when evidence must be retained.
- Cleanup does not replace backups, authorization, input validation, rich-text sanitization, or upload security.
- New fixtures must use explicit prefixes or fixture markers. Never broaden the cleanup query by guessing from business data.
