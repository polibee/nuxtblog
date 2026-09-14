# Nuxt Admin

[中文](README.md) · [English](README.en.md)

A production-grade, extensible admin application framework on **Nuxt 4 + Vue 3.5 + TypeScript**, inspired by Laravel Filament and Strapi.
Not a template — a framework: declare resources, and full CRUD panels are generated for you.

> **Status**: framework + security mechanisms are production-ready (four quality gates green, zero scan findings in project source).
> To deploy as a live application, complete the three swap items in the [production audit](docs/工程审计报告.md) (real DB, real auth, HTTPS hardening).

## Features

- **Declarative resources** — one TS file per resource generates List / Create / View / Edit pages, REST API and permissions
- **Content Type builder** — model content visually; collections, admin pages and REST endpoints (`ct_*`) are generated at runtime, no restart
- **RBAC** — roles with a visual permission matrix, wildcard matching, enforced on both client and server
- **Media library** — multipart upload (≤10MB), fs storage, byte streaming, purge-on-delete, thumbnails
- **Content lifecycle** — draft → review → scheduled → published → archived, with a scheduler that auto-publishes and broadcasts events
- **Revisions** — automatic snapshots before update/delete, version list, one-click restore
- **Webhooks** — event subscription, HMAC-SHA256 signatures, exponential-backoff retry queue, SSRF-guarded dispatch
- **Event bus** — `content.before*/after*` lifecycle hooks for plugins
- **Taxonomy** — unlimited-depth category/tag tree with cascade-delete protection
- **Menus** — nested navigation structures editable via recursive repeater
- **Settings** — grouped visual forms, public/private isolation, `/api/public-settings`
- **SEO** — per-entry meta fields, `/sitemap.xml`, `/rss.xml`, noindex filtering
- **Draft preview** — 15-minute token URLs to standalone noindex preview pages
- **Rich text** — full Tiptap editor (tables, images, task lists, align, colors, sub/superscript) with server-side HTML sanitization
- **Autosave** — debounced per-user drafts with restore banner
- **Mail** — SMTP / Aliyun DirectMail / Resend drivers with test sending
- **Database & cache** — MySQL 8+ is currently recommended for production; PostgreSQL / Supabase migration is still in progress, with optional Redis for sessions/tokens/drafts
- **Page cache & monitoring** — public-endpoint response caching with event-driven
  invalidation, hit-rate charts and one-click purge
- **i18n** — zh-CN / English, zero mixed-language UI

## Tech Stack

Nuxt 4 · Nitro · Vue 3.5 · TypeScript · Tailwind CSS v4 · shadcn-style components · Reka UI · TanStack Table Vue · VeeValidate + Zod · Pinia · Tiptap · Vitest

## Quick Start

```bash
npm install
npm run dev          # http://localhost:3000
```

See the [PM2 / Docker deployment guide](docs/deployment/pm2-docker.en.md) for production deployment. MySQL 8+ is currently recommended. Keep `.env` private and never commit passwords or keys.

### VPS and GPU resources

[![RackNerd VPS](https://img.shields.io/badge/RackNerd-VPS%20hosting-2563eb?logo=serverfault&logoColor=white)](https://www.racknerd.com/)
[![Vast.ai GPU](https://img.shields.io/badge/Vast.ai-GPU%20rental-7c3aed?logo=nvidia&logoColor=white)](https://cloud.vast.ai/?ref_id=91181)

Use RackNerd to rent a VPS for NuxtBlog deployment and Vast.ai for GPU-backed AI, inference, or batch workloads. These are external resource links, not zero-touch deployment: they do not create DNS/TLS, migrate the database, or configure the application automatically. Follow the [PM2 / Docker deployment guide](docs/deployment/pm2-docker.en.md) for MySQL, environment variables, migrations, and security checks.

Demo account (isolated demo site only, read-only):

| Account | Role | Capabilities |
|---|---|---|
| `demo@example.com` | Viewer | Read-only access to the public site and admin data |

Enable it explicitly with `DEMO_ACCOUNT_ENABLED=true` and set `DEMO_ACCOUNT_PASSWORD`. Keep it disabled on a real site and never connect a public demo to production data.

## Quality Baseline

| Gate | Result |
|---|---|
| ESLint / vue-tsc | 0 / 0 |
| Vitest | 54/54 (form validation, permissions, query engine, XSS sanitization, SSRF, HMAC, XML, compiler) |
| Production build | ✅ Nitro node-server |
| CI | Lint → Typecheck → Test → Build |
| Deep security scan | 0 findings in project source |

## Documentation

| Doc | Audience | Content |
|---|---|---|
| [介绍文档](docs/介绍文档.md) (zh) | Everyone | Positioning, features, Strapi comparison, architecture |
| [规划文档](docs/规划文档.md) (zh) | Maintainers | V0.1→V0.4 roadmap with per-batch status |
| [开发指南](docs/开发指南.md) (zh) | Developers | Concepts, auto-import inventory, component list, module walkthrough, API reference |
| [工程审计报告](docs/工程审计报告.md) (zh) | Maintainers | Audit findings, verification matrix, production-readiness verdict |
| [PM2 / Docker deployment](docs/deployment/pm2-docker.en.md) (English) | Operators | PM2, Docker Compose, MySQL, environment variables, release checks |
| [Test data cleanup](docs/guides/demo-data-cleanup.en.md) (English) | Admins/operators | One-click cleanup scope, backups, and database compatibility |
| [Bilingual UI screenshots](docs/ui-showcase.en.md) / [中文](docs/ui-showcase.zh-CN.md) | Product, QA, documentation | Reproducible Chinese/English public and admin capture sources and acceptance focus |

## License

Private project — all rights reserved by the owner.
