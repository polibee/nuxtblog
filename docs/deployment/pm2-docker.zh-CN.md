# NuxtBlog 部署手册（PM2 / Docker）

## 当前数据库建议

当前项目生产建议使用已验证的 MySQL 8+。PostgreSQL/Supabase 的 Repository 迁移尚未全量完成，不能只修改 `DB_DRIVER` 就作为生产兼容方案；Docker Compose 也默认启动 MySQL。

所有部署都必须使用独立 `.env`，不要把密码、`DATABASE_URL`、支付密钥、Webhook 密钥、AI Key 或管理员凭据提交到 Git。

## 推荐资源入口

[![RackNerd VPS](https://img.shields.io/badge/RackNerd-VPS%20%E4%B8%BB%E6%9C%BA-2563eb?logo=serverfault&logoColor=white)](https://www.racknerd.com/)
[![Vast.ai GPU](https://img.shields.io/badge/Vast.ai-GPU%20%E7%A7%9F%E7%94%A8-7c3aed?logo=nvidia&logoColor=white)](https://cloud.vast.ai/?ref_id=91181)

- RackNerd：适合租用 VPS，运行 Nuxt、PM2、Docker 和 MySQL。
- Vast.ai：适合临时租用 GPU 执行 AI 推理或批处理，不是 NuxtBlog 的必需依赖。

资源平台不会替你完成应用部署。你仍需准备服务器、MySQL、域名、HTTPS、`.env` 和数据库备份；GPU 任务还应单独管理密钥、数据和网络访问权限。

## PM2 部署

适用于 Linux/WSL/云服务器上直接运行 Node.js。

```bash
cp .env.example .env
# 编辑 .env：至少配置 DB_DRIVER=mysql、DB_HOST、DB_PORT、DB_NAME、DB_USER、DB_PASSWORD
npm install -g pm2
bash scripts/deploy-pm2.sh
```

脚本会执行 `npm ci`、生产构建、`pm2 startOrReload` 和 `pm2 save`。应用启动时会执行现有 MySQL Drizzle migration runner；首次上线前请先备份数据库。

### VPS 首次上线不是零操作

部署程序不会自动创建 VPS 上的 MySQL 实例、数据库账号、域名 DNS、HTTPS 证书或管理员凭据。首次上线至少需要：

1. 在 VPS 安装并启动 MySQL 8+，创建专用数据库和最小权限账号。
2. 将代码部署到服务器，复制 `.env.example` 为私有 `.env`，填写 `DB_DRIVER=mysql`、数据库连接信息、`BLOG_ADMIN_*` 和生产密钥。
3. 执行 `npm ci` 和 `npm run build`；应用启动时会执行 MySQL Drizzle migration，首次启动后检查日志确认迁移完成。
4. 使用管理员账号登录后台，检查站点设置、权限、邮件/Webhook、媒体存储和定时任务。
5. 配置反向代理、HTTPS、备份策略和防火墙，再做一次健康检查与核心流程回归。

后续同一版本发布通常只需拉取代码、更新 `.env`、执行部署脚本并检查迁移日志；数据库 schema 发生变化时仍必须执行对应迁移，不能只替换构建产物。

常用命令：

```bash
pm2 status
pm2 logs nuxtblog
pm2 restart nuxtblog --update-env
pm2 stop nuxtblog
pm2 delete nuxtblog
pm2 startup
```

`ecosystem.config.cjs` 默认单进程运行。确认缓存、会话和定时任务支持多实例后，再设置 `PM2_INSTANCES=2` 或更高值。

## Docker 部署

### 使用 Compose 自带 MySQL

```bash
cp .env.example .env
# 设置 DB_PASSWORD 和 MYSQL_ROOT_PASSWORD；Compose 会在容器网络内使用 DB_HOST=mysql
docker compose up -d --build
docker compose ps
docker compose logs -f nuxtblog
```

访问 `http://服务器地址:3000/`。Compose 会持久化 MySQL 和 Nitro `.data` 到命名卷。不要使用 `docker compose down -v`，除非确认要删除数据库卷。

### 使用外部 MySQL

不要启动 Compose 的 `mysql` 服务，只构建并运行应用容器，并在 `.env` 中填写外部 MySQL 的 `DB_HOST`、`DB_PORT`、`DB_NAME`、`DB_USER`、`DB_PASSWORD`。此时需要自行保证数据库网络可达、备份、TLS 和迁移权限。

## 上线检查

- `NODE_ENV=production`，反向代理启用 HTTPS。
- 生产环境 `ALLOW_MEMORY_FALLBACK=false`，数据库不可用时应用失败，不静默切换内存。
- `SEED_DEMO=false`；演示账号只在隔离演示数据库开启。
- 设置 `COOKIE_SECURE=true`（HTTPS）。
- 放行 `/` 健康检查，限制管理端、登录、评论和上传接口的速率。
- 先执行 `npm run lint`、`npm run typecheck`、`npm test -- --run`、`npm run build`。
- 当前清理测试数据功能只支持 MySQL；PostgreSQL/Supabase 环境不会执行删除。
