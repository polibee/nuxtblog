# P01 Authentication + Users

## 1. 基本信息

~~~text
Phase ID: P01
Phase Name: Authentication + Users
Owner: polibee
NuxtAdmin Base Commit: a48695f
Depends On: P00
Target Version: v0.1.0-p01
Status: COMPLETE
~~~

## 2. 目标与非目标

### 2.1 目标

- 真实认证替换演示 auth：users 表账号、scrypt 密码哈希、MySQL 持久化会话（只存 token 的 SHA-256）、登出/会话过期。
- 登录限流（5 次/分钟/IP+邮箱）、会话 TTL 可配（SESSION_TTL_HOURS，默认 8h）、COOKIE_SECURE 预留 HTTPS。
- 启动 Seed 初始管理员（BLOG_ADMIN_EMAIL/PASSWORD，users 表为空时）。
- 密码重置全流程：request（幂等 200，防枚举）→ confirm（token 一次性、1h 过期、改密后清除该用户全部会话）；邮件经基座 sendMail（smtp/aliyun/resend），未配置时打印链接到服务端日志。
- 用户管理 API/界面真实化：/api/admin/users 静态目录接管（该名资源从演示 Registry 转正），创建必填密码、编辑留空不改、禁自删、禁删/禁降级最后活跃管理员。
- 登录页移除演示账号卡与预填，新增忘记密码链接与 /reset-password 页面。
- Dashboard stats 的用户计数改读真实 users 表。

### 2.2 非目标

- 不做 OAuth/JWT、邮箱验证、双因子。
- 不做角色管理表（v1.0 表目录无 roles；role→permissions 映射在 server/utils/permissions.ts，与演示种子一致）。
- 不迁移演示 posts/orders 数据（P04+）。

## 3. NuxtAdmin 接入点

~~~text
Module: app/modules/users（UserResource 增加密码字段，其余复用）
Resource: users（permissionPrefix: users）
Server API: /api/auth/login|logout|me、/api/auth/password-reset/request|confirm、/api/admin/users CRUD（静态目录接管）
Server Service: server/modules/users/user.service.ts
Server Repository: user.repository.ts、session.repository.ts、schema/users.ts
Server Utils: password.ts（scrypt+sha256）、permissions.ts（角色映射）、rate-limit.ts
Permissions: users.view/create/edit/delete（演示 editor 种子已含）
~~~

## 4. 数据模型

### 4.1 Entity

~~~text
Table: users
Fields: id, email varchar(255), password_hash varchar(255), name varchar(80),
        role varchar(20) default 'viewer', status varchar(20) default 'active',
        created_at, updated_at
Indexes: UNIQUE(email)（utf8mb4_unicode_ci 天然大小写不敏感），INDEX(role), INDEX(status)
Delete strategy: 硬删除；sessions/password_reset_tokens 级联删除

Table: sessions
Fields: id, token_hash varchar(64) UNIQUE, user_id FK CASCADE, expires_at, created_at
Table: password_reset_tokens
Fields: id, token_hash varchar(64) UNIQUE, user_id FK CASCADE, expires_at, used_at, created_at
~~~

### 4.2 Translation

不适用。用户为账号数据（name 为账户属性而非内容），v1.0 表目录无 users_translations。

### 4.4 Migration

~~~text
Migration: 0003_auth_tables.sql
Rollback: DROP 三表
~~~

## 5. Repository 与 Service

- user.repository：分页/搜索/排序列表（LIKE q）、按邮箱/ID 查找、emailExists(excludeId)、insert/update/delete、计数（总数/按状态/按角色+状态）。
- session.repository：create/findActive（join users，含过期过滤）/delete/deleteForUser/deleteExpired、重置令牌 create/findUsable/markUsed。
- user.service：zod strict 校验（shared/schemas/user.ts）、邮箱唯一 409、最后活跃管理员保护 409、改密后吊销会话、seedInitialAdmin。
- auth.ts：保持原导出契约（createSession/destroySession/getSessionUser/requireUser/requirePermission/set|clearSessionCookie），内部全部 DB 化；新增 pruneSessions。

## 6. Resource / Widget

UserResource form 增加密码字段（helpText：创建必填/编辑留空不改）；服务端为密码规则的最终裁决（客户端不做差异 required）。

## 7. Route 与 API

~~~text
POST /api/auth/login                     公开；限流 5/min/IP+邮箱；401 失败；429 超限
POST /api/auth/logout                    登录用户
GET  /api/auth/me                        401 未登录（修正原未 await 问题）
POST /api/auth/password-reset/request    公开；恒 200（防枚举）；限流 3/10min/IP
POST /api/auth/password-reset/confirm    公开；限流 10/10min/IP；400 无效/过期
GET/POST/PUT/DELETE /api/admin/users/**  users.*；404/409/422 统一映射
~~~

Server 检查：显式 import ✓ / Handler 无 SQL ✓ / 经 Service ✓ / Server 二次权限 ✓（[id].delete 先 requireUser 取当前用户再查权限）。

## 8. Analytics

不适用。

## 9. 权限矩阵

| 操作 | 未登录 | Viewer | Editor | Admin |
|---|---:|---:|---:|---:|
| 登录/重置 | ✅ | ✅ | ✅ | ✅ |
| 用户列表/详情 | ❌ 401 | ✅ | ✅ | ✅ |
| 创建/编辑 | ❌ | ❌ 403 | ❌* | ✅ |
| 删除 | ❌ | ❌ | ❌* | ✅（有保护） |

*演示 editor 权限映射不含 users.create/edit/delete；映射表在 permissions.ts。

实测：未登录 users API → 401；降级/删除唯一 admin → 409；自删 → 409；6 次登录 → 第 6 次 429。

## 10. 多语言检查

不涉及自然语言内容字段；错误文案沿用基座 i18n（auth.* 键）。

## 11. 测试计划

- Unit：password（哈希往返/错密码/畸形存储/盐随机）、rate-limit（限额/身份隔离/配额/清理）、user schema（大小写归一、密码长度、未知键、部分更新）。
- Integration（实测）：登录/会话/401、创建用户（中文 UTF-8 往返）、保护规则、重置闭环（旧密码 401→新密码 200）、限流 429。

## 12. 验收标准（节选）

~~~text
Given 全新数据库
When Nitro 启动
Then 自动建表并 Seed 初始管理员（凭据来自 BLOG_ADMIN_*，无则默认 admin@example.com/admin123456）

Given 正确凭据
When POST /api/auth/login
Then Set-Cookie admin_session（httpOnly），/api/auth/me 返回用户+权限

Given 会话 cookie 被篡改或过期
When 访问任意 admin API
Then 401

Given 最后一个活跃 admin
When 降级/停用/删除（非本人=409 保护；本人自删=409）
Then 拒绝
~~~

## 13. 质量闸门

~~~text
npm run lint      → PASS
npm run typecheck → PASS
npm test          → PASS（105 tests / 15 files）
npm run build     → PASS
集成验证          → 登录/me/401/409 保护/重置闭环/429 限流 全部实测通过
~~~

## 14. 发布、监控与回滚

~~~text
Migration 顺序: 0003（追加）
环境变量: BLOG_ADMIN_EMAIL/PASSWORD/NAME、SESSION_TTL_HOURS、COOKIE_SECURE
日志指标: [auth] 会话清理失败、[auth] 重置邮件发送失败（附链接）
安全注意: 生产必须 HTTPS + COOKIE_SECURE=true；限流为单机内存实现，多实例需 Redis（P19 加固）
回滚方式: DROP 三表 + 还原 auth.ts（git）
~~~

## 15. 完成记录

~~~text
Phase Status: COMPLETE
Acceptance: PASS
Known Issues:
  - 限流器为单节点内存实现（架构文档生产清单已列 Redis 化）
  - 演示 roles 资源/演示用户集合仍在（P08 Dashboard 清理时一并处理）
Follow-up: 登录失败统一延迟（防时序探测）可在 P19 加固
~~~
