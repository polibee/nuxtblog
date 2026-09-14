# Public Routing and Localization Design

## Decision

Keep `/profile` as the public author homepage and `/account` as the authenticated user center. `/resume` is a compatibility alias that permanently redirects to `/profile`.

Public content uses a path prefix for non-default locales: the default locale has no prefix, while English uses `/en`. Query locale parameters remain accepted only as legacy input and redirect to the canonical path.

## Canonical routes

- `/`, `/en/`
- `/posts/:alias`, `/en/posts/:alias`
- `/pages/:alias`, `/en/pages/:alias`
- `/profile`, `/en/profile`
- `/account` remains an authenticated account route; its UI locale may follow the cookie/query without changing its identity.

Article, page, taxonomy and profile links must preserve the selected locale prefix. Alias changes continue to resolve through the existing 301 redirect repository.

## Compatibility and failure behavior

Legacy `?locale=en` URLs redirect once to `/en/...`; canonical URLs do not append locale query parameters. A missing translation returns a localized not-found/translation-unavailable response rather than silently rendering another language. Reserved aliases cannot occupy system routes.

## Verification

Test locale switching and deep links for home, post, page, profile, taxonomy, old query URLs, `/resume`, and changed aliases. Verify SSR status codes, no redirect loops, canonical links, and mobile navigation.
