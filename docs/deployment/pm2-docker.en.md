# NuxtBlog Deployment Guide (PM2 / Docker)

## Current database recommendation

Use the verified MySQL 8+ path for production. PostgreSQL/Supabase repository migration is not complete, so changing `DB_DRIVER` alone is not a production compatibility guarantee. The Docker Compose example therefore starts MySQL by default.

Use a private `.env` for every deployment. Never commit passwords, `DATABASE_URL`, payment credentials, webhook secrets, AI keys, or administrator credentials.

## Recommended resource links

[![RackNerd VPS](https://img.shields.io/badge/RackNerd-VPS%20hosting-2563eb?logo=serverfault&logoColor=white)](https://www.racknerd.com/)
[![Vast.ai GPU](https://img.shields.io/badge/Vast.ai-GPU%20rental-7c3aed?logo=nvidia&logoColor=white)](https://cloud.vast.ai/?ref_id=91181)

- RackNerd: suitable for hosting Nuxt, PM2, Docker, and MySQL on a VPS.
- Vast.ai: suitable for temporary GPU-backed AI inference or batch jobs; it is not required by NuxtBlog.

These providers do not deploy the application for you. You still need to provision the server, MySQL, domain, HTTPS, private `.env`, and backups. GPU workloads should also use separate credentials, data isolation, and network controls.

## PM2

Use this mode when running Node.js directly on Linux, WSL, or a cloud VM:

```bash
cp .env.example .env
# Configure DB_DRIVER=mysql, DB_HOST, DB_PORT, DB_NAME, DB_USER, and DB_PASSWORD
npm install -g pm2
bash scripts/deploy-pm2.sh
```

The script runs `npm ci`, builds the production output, reloads PM2, and saves the process list. The existing MySQL Drizzle migration runner runs at application startup; back up the database before the first deployment.

### A VPS deployment is not zero-touch

The application does not create the VPS MySQL instance, database users, DNS records, TLS certificates, or administrator credentials automatically. A first production deployment must at least:

1. Install and start MySQL 8+ on the VPS, then create a dedicated database and least-privilege user.
2. Deploy the code, copy `.env.example` to a private `.env`, and configure `DB_DRIVER=mysql`, database credentials, `BLOG_ADMIN_*`, and production secrets.
3. Run `npm ci` and `npm run build`. The app runs the MySQL Drizzle migrations at startup; inspect logs and confirm they completed successfully.
4. Sign in to the admin panel and verify site settings, permissions, mail/Webhooks, media storage, and scheduled jobs.
5. Configure a reverse proxy, HTTPS, backups, and firewall rules, then run a health check and the core-flow regression checks.

For later releases, pull the version, update `.env`, run the deployment script, and inspect migration logs. Whenever the schema changes, the matching migration must still run; replacing only the build output is not sufficient.

Useful commands:

```bash
pm2 status
pm2 logs nuxtblog
pm2 restart nuxtblog --update-env
pm2 stop nuxtblog
pm2 delete nuxtblog
pm2 startup
```

`ecosystem.config.cjs` uses one process by default. Set `PM2_INSTANCES=2` or more only after verifying cache, sessions, and scheduled jobs are safe for multiple instances.

## Docker

### Compose with bundled MySQL

```bash
cp .env.example .env
# Set DB_PASSWORD and MYSQL_ROOT_PASSWORD; the app uses DB_HOST=mysql
docker compose up -d --build
docker compose ps
docker compose logs -f nuxtblog
```

Open `http://server-address:3000/`. Named volumes persist MySQL and Nitro `.data`. Do not run `docker compose down -v` unless deleting the database volume is intentional.

### External MySQL

Do not start the Compose `mysql` service. Build and run only the application image, and set the external MySQL `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, and `DB_PASSWORD` in `.env`. You are responsible for network access, backups, TLS, and migration permissions.

## Release checklist

- Set `NODE_ENV=production` and terminate TLS at a reverse proxy.
- Keep `ALLOW_MEMORY_FALLBACK=false`; database failures must not silently switch to memory.
- Keep `SEED_DEMO=false`; enable the demo account only with an isolated demo database.
- Set `COOKIE_SECURE=true` when serving over HTTPS.
- Rate-limit login, admin, comments, and uploads; expose `/` for health checks.
- Run `npm run lint`, `npm run typecheck`, `npm test -- --run`, and `npm run build`.
- The test-data cleanup endpoint currently supports MySQL only and refuses to delete on PostgreSQL/Supabase.
