# P14 Export and Hardening

## 1. 基本信息

~~~text
Phase ID: P14
Phase Name: Data Export + Security Hardening（含 P13e 商品页布局微调）
Owner: polibee
NuxtAdmin Base Commit: a48695f
Depends On: P13 系列
Target Version: v0.2.0-p14
Status: COMPLETE
~~~

## 2. 实现范围

### 数据导出（commerce doc §11）
- **迁移 0018**：`export_jobs`（type/status/date_from/date_to/row_count/file_key/error/created_by；date 列 mode:'string'）
- **导出服务**：orders（日期筛选）、transactions（日期筛选）、inventory summary（按商品×状态聚合，**绝不含卡密** §12.2）；CSV 生成含引号转义 + 公式注入防护（=+-@ 前缀加 `'`）；文件落 nitro `exports` storage（nuxt.config 新增挂载 .data/exports）
- **API**：POST /api/admin/exports（store.exports.create）、GET /（store.exports.view）、GET /:id/download（Completed 才可下载；文件丢失 410）
- **后台页**：/admin/exports（ExportsManagerPage）——类型+日期范围创建、job 列表（状态徽章/行数/下载链接）

### 安全加固（commerce doc §12）
- **安全响应头**（server/middleware/security-headers.ts，全站生效）：X-Content-Type-Options nosniff、X-Frame-Options DENY、Referrer-Policy strict-origin-when-cross-origin、Permissions-Policy、CSP `frame-ancestors 'none'; base-uri 'self'; object-src 'none'`（script CSP 因 Nuxt payload 内联脚本暂不强制，记录为后续项）
- **上传白名单**：PNG/JPEG/GIF/WebP/PDF；图片做魔数校验（declared ≠ content → 415）；**SVG 排除**（同源 script 存储型 XSS 向量）
- **Cookie 复核**：admin_session 已是 HttpOnly + SameSite=Lax + 可选 Secure（COOKIE_SECURE=true）
- CSV 公式注入防护（同上）

### P13e 商品页布局（用户反馈）
- 详情页 PC 双栏（lg:grid-cols-2：左图右信息+购买），移动端保持上下堆叠
- 商品图统一 4:3 object-cover 自动裁剪（列表卡片与详情页一致，浏览器实测 677×508=4:3）

## 3. 新增文件

~~~text
server/repositories/migrations/0018_export_jobs.sql (+meta)
server/repositories/schema/exports.ts
server/modules/exports/export.service.ts
server/api/admin/exports/index.{get,post}.ts + [id]/download.get.ts
server/middleware/security-headers.ts
app/modules/exports/{module.ts, admin/ExportsResource.ts, admin/ExportsManagerPage.vue}
~~~

## 4. 验证结果

~~~text
npm run lint      → PASS
npm run typecheck → PASS
npm test          → PASS（167 tests / 21 files）
npm run build     → PASS
真实 MySQL E2E    → PASS（见 §5）
~~~

## 5. 真实环境 E2E（Laragon MySQL 8.0.30）

- 订单导出（2026 全年）→ job completed rows=10 → CSV 下载（头行+10 行、Content-Disposition 正常、响应头含 nosniff）
- 交易流水导出 → 4 行 charge 流水；库存摘要导出 → 按状态聚合（delivered/reserved 计数），无任何卡密字段
- 安全断言：curl -I 全站返回 5 项安全头；登录 Set-Cookie 带HttpOnly/SameSite=Lax；SVG 上传 415、伪造 PNG（魔数不符）415
- 后台 /admin/exports 页面渲染（新建表单 + 3 条 job + 下载链接）
- 商品详情页双栏与 4:3 裁剪（浏览器 DOM 实测）

## 6. 修复记录（E2E 揪出）

- toRow 漏映射 fileKey → 下载恒 409（"completed" 状态却拒绝）
- Date 对象直接内插 Content-Disposition → node 头校验 500；toRow 归一化 ISO 日期
- drizzle mysql date 列未声明 mode:'string' → 插入类型不匹配

## 7. 完成记录

~~~text
Phase Status: COMPLETE
Acceptance: PASS（四道闸门 + 真实环境端到端）
Known Issues: script 级 CSP 未启用（Nuxt payload 内联脚本）；导出为同步生成（v1 数据量适用，大表需转异步 job）
Follow-up: P15 多语言路由（§20 路线图）或按需求排期
~~~
