# Bilingual UI Screenshots and Feature Index

> The capture baseline uses local MySQL demo data. Accounts, orders, webhook URLs, API keys, and database connection strings are intentionally excluded. The links below are reproducible live capture sources for the Chinese and English documentation sets.

## Public pages

| Feature | Chinese page | English page | Capture focus |
| --- | --- | --- | --- |
| Home, post cards, layout and pagination | [Chinese home](http://127.0.0.1:3001/) | [English home](http://127.0.0.1:3001/en) | Header locale switcher, list/grid, views/comments, pagination, author sidebar and footer groups |
| Article detail | [Chinese article](http://127.0.0.1:3001/posts/nuxt4-blog-start) | [English article](http://127.0.0.1:3001/en/posts/demo-coffee-and-code) | Metadata, bounded images, universal link cards, compact author card and comments |
| Public author profile | [Chinese profile](http://127.0.0.1:3001/profile) | [English profile](http://127.0.0.1:3001/en/profile) | Public profile, project previews, social channels and responsive layout |
| Friends | [Chinese friends](http://127.0.0.1:3001/friends) | [English friends](http://127.0.0.1:3001/en/friends) | Link directory, application form, validation and guest state |
| Advertising purchase | [Chinese advertising](http://127.0.0.1:3001/advertising) | [English advertising](http://127.0.0.1:3001/en/advertising) | Placements, period pricing, budget, review state and purchase entry |
| Store and membership | [Chinese store](http://127.0.0.1:3001/store) | [English store](http://127.0.0.1:3001/en/store) | Products, inventory, purchase entry and membership benefits |
| Sitemap | [Chinese sitemap](http://127.0.0.1:3001/sitemap) | [English sitemap](http://127.0.0.1:3001/en/sitemap) | Pages, posts, taxonomy and public resource discovery |

## Admin pages

Capture these pages after administrator login. Admin captures must cover lists, forms, details, permissions and error feedback without showing passwords, API keys or connection strings.

| Feature | Admin entry | English capture | Capture focus |
| --- | --- | --- | --- |
| Dashboard | [/admin](http://127.0.0.1:3001/admin) | Switch Language to English | User, post, page, comment, cache metrics and Visit site |
| Posts | [/admin/posts](http://127.0.0.1:3001/admin/posts) | Same page, English | Locale filter, list, pagination, create/edit/preview |
| Pages | [/admin/pages](http://127.0.0.1:3001/admin/pages) | Same page, English | Default pages, aliases, empty-content save and edit hydration |
| Navigation | [/admin/navigations](http://127.0.0.1:3001/admin/navigations) | Same page, English | Header/footer groups, aliases, language variants and public linkage |
| Comments | [/admin/comments](http://127.0.0.1:3001/admin/comments) | Same page, English | Moderation, admin replies, guest metadata, pagination and export |
| Campaigns | [/admin/advertising/campaigns](http://127.0.0.1:3001/admin/advertising/campaigns) | Same page, English | Review materials, orders, price snapshots, budget and delivery status |
| Placements and delivery | [/admin/advertising/slots](http://127.0.0.1:3001/admin/advertising/slots) | Same page, English | Responsive slots, pricing, creatives, impressions/clicks |
| Notifications | [/admin/notifications](http://127.0.0.1:3001/admin/notifications) | Same page, English | Channels, subscriptions, outbox, delivery and retries |
| AI assistant and analytics | [/admin/ai-assistant](http://127.0.0.1:3001/admin/ai-assistant) | Same page, English | Model settings and read-only token/cache/cost analytics |
| Settings | [/admin/settings/general](http://127.0.0.1:3001/admin/settings/general) | Same page, English | Group tabs, site info, SEO, analytics and verification fields |
| Author card | [/admin/author-card](http://127.0.0.1:3001/admin/author-card) | Same page, English | Sidebar card data, social channels and public profile linkage |
| Demo data cleanup | [/admin/database](http://127.0.0.1:3001/admin/database) | Same page, English | Scope, confirmation, result and protected records |

## Capture convention

1. Use a 1440×900 desktop viewport and a 390×844 mobile viewport to verify collapsed navigation, card wrapping and table overflow.
2. The Chinese guide references Chinese page entries and this guide references English entries. For admin pages use the visible Language control instead of guessing locale query parameters.
3. Remove test dialogs and sensitive fields before capture. Committed image files belong in `docs/screenshots/` with stable names such as `public-home-zh.png` and `admin-dashboard-en.png`.
4. The current database baseline is Laragon MySQL. PostgreSQL/Supabase remains paused per the project audit and is not claimed as verified by this gallery.

