# Nuxt Admin

[中文](README.md) · [English](README.en.md)

基于 **Nuxt 4 + Vue 3.5 + TypeScript** 的生产级可扩展后台管理框架与 CMS，设计思想致敬 Laravel Filament 与 Strapi。
不是模板，而是框架：业务以「资源声明」方式接入，CRUD 页面由引擎自动生成。

> **状态**：框架与安全机制达到生产标准（四闸门全绿、源码深度扫描零发现）。
> 作为可上线应用，需先完成 [生产就绪审计](docs/工程审计报告.md) 中的三项替换（真实数据库、真实鉴权、HTTPS 加固）。

## 核心能力

- **声明式资源** — 一个 TS 文件生成 列表/创建/详情/编辑 四页面 + REST API + 权限
- **内容类型建模器** — 后台可视化建模，运行时自动生成集合、页面与 API，无需重启
- **RBAC 权限** — 角色权限矩阵可视化编辑，通配匹配，前后端双层执行
- **媒体库** — multipart 上传、缩略图、字节回读、删除清存储
- **内容生命周期** — 草稿→待审→排期→发布→归档，调度器到点自动发布并广播事件
- **修订历史** — 更新/删除前自动快照，版本列表一键恢复
- **Webhook** — 事件订阅、HMAC-SHA256 签名、指数退避重试、SSRF 防护
- **事件总线** — `content.before*/after*` 生命周期 Hook（插件挂载点）
- **Taxonomy** — 无限级分类树 + 级联删除保护
- **Menu 管理** — 嵌套菜单结构可视化编辑
- **Settings** — 分组可视化表单、公开/私密隔离、公开端点
- **SEO** — 逐条 SEO 元字段、`/sitemap.xml`、`/rss.xml`、noindex 过滤
- **Draft Preview** — 15 分钟令牌预览页（noindex）
- **Tiptap 富文本** — 表格/图片/任务列表/对齐/颜色/上下标，服务端白名单清洗防 XSS
- **Autosave** — 按用户防抖草稿 + 恢复横幅
- **邮件服务** — SMTP / 阿里云 DirectMail / Resend 三驱动 + 测试发送
- **数据库与缓存** — 当前生产建议使用已验证的 MySQL 8+；PostgreSQL / Supabase 适配仍在迁移中，Redis 可用于会话/令牌/草稿缓存
- **页面缓存与监控** — 公开端点响应缓存，事件驱动失效，命中率图表与一键清空
- **双语界面** — 中文/English 一致切换，零混排

## 技术栈

| 层 | 选型 |
|---|---|
| 运行时 | Nuxt 4 · Nitro · Vue 3.5 · TypeScript |
| UI | Tailwind CSS v4 · shadcn 风格组件 · Reka UI |
| 表格 | TanStack Table Vue（服务端分页/排序/搜索）|
| 表单 | VeeValidate + Zod（Schema 自动编译校验规则）|
| 富文本 | Tiptap v3（服务端 sanitize-html 清洗）|
| 状态 | Pinia（仅 UI 偏好与会话，不存服务端数据）|

## 快速开始

```bash
npm install
npm run dev        # http://localhost:3000
```

生产部署请参阅 [PM2 / Docker 部署手册](docs/deployment/pm2-docker.zh-CN.md)。当前建议使用 MySQL 8+；部署前请配置私有 `.env`，不要提交密码和密钥。

演示账号（仅隔离演示站，默认只读）：

- `demo@example.com` — Viewer，只读查看前台和后台数据
- 通过 `DEMO_ACCOUNT_ENABLED=true` 启用，并使用 `DEMO_ACCOUNT_PASSWORD` 设置密码
- 生产站请保持演示账号关闭，不要连接真实业务数据库

## 质量基线

| 闸门 | 结果 |
|---|---|
| ESLint / vue-tsc | 0 / 0 |
| Vitest | 54/54（表单校验、权限矩阵、查询引擎、XSS 清洗、SSRF、HMAC、XML、编译器）|
| 生产构建 | ✅ Nitro node-server |
| CI | Lint → Typecheck → Test → Build 四道闸门 |
| 深度安全扫描 | 项目源码 0 发现 |

## 文档导航

| 文档 | 读者 | 内容 |
|---|---|---|
| [介绍文档](docs/介绍文档.md) | 所有人 | 项目定位、特性、Strapi 对标、架构、快速开始 |
| [规划文档](docs/规划文档.md) | 维护者 | V0.1→V0.4 阶段规划与批次状态 |
| [开发指南](docs/开发指南.md) / [Dev Guide (EN)](docs/development-guide.en.md) | 开发者 | 核心概念、自动导入清单、组件清单、模块实战、API 参考 |
| [工程审计报告](docs/工程审计报告.md) | 维护者 | 审计发现、验证矩阵、生产就绪正式结论 |
| [开发文档](docs/开发文档.md) | 设计溯源 | 原始设计蓝本 |
| [通用架构设计与开发约束](docs/architecture/通用架构设计与开发约束.md) | 维护者/开发者 | 模块边界、Repository context、Alias、i18n、安全、异步和质量闸门 |
| [PM2 / Docker 部署手册](docs/deployment/pm2-docker.zh-CN.md) / [English](docs/deployment/pm2-docker.en.md) | 部署人员 | PM2、Docker Compose、MySQL、环境变量和上线检查 |
| [测试数据清理手册](docs/guides/demo-data-cleanup.zh-CN.md) / [English](docs/guides/demo-data-cleanup.en.md) | 管理员/部署人员 | 一键清理测试数据、范围、备份和数据库兼容说明 |

## License

私有项目 — 版权归所有者。
