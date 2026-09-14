# NuxtBlog 部署手册（PM2 / Docker）

## 当前数据库建议

当前项目生产建议使用已验证的 MySQL 8+。PostgreSQL/Supabase 的 Repository 迁移尚未全量完成，不能只修改 `DB_DRIVER` 就作为生产兼容方案；Docker Compose 也默认启动 MySQL。

所有部署都必须使用独立 `.env`，不要把密码、`DATABASE_URL`、支付密钥、Webhook 密钥、AI Key 或管理员凭据提交到 Git。

## PM2 部署

适用于 Linux/WSL/云服务器上直接运行 Node.js。

```bash
cp .env.example .env
# 编辑 .env：至少配置 DB_DRIVER=mysql、DB_HOST、DB_PORT、DB_NAME、DB_USER、DB_PASSWORD
npm install -g pm2
bash scripts/deploy-pm2.sh
```

脚本会执行 `npm ci`、生产构建、`pm2 startOrReload` 和 `pm2 save`。应用启动时会执行现有 MySQL Drizzle migration runner；首次上线前请先备份数据库。

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
