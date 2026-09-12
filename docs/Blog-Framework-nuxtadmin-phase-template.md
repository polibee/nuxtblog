# 博客框架 NuxtAdmin Phase 开发与验收模板

> 每个 Phase 复制一份，保存到 docs/phases/Pxx-<name>.md。模板针对 Nuxt 4 + Nitro + NuxtAdmin + MySQL/Drizzle，并包含 Analytics 专用检查项。

## 1. 基本信息

~~~text
Phase ID:
Phase Name:
Owner:
NuxtAdmin Base Commit:
Depends On:
Target Version:
Status: PLANNED | IN_PROGRESS | BLOCKED | COMPLETE
~~~

## 2. 目标与非目标

### 2.1 目标

说明本 Phase 解决的用户问题、管理员结果、公开页面变化和完成后的运行能力。

### 2.2 非目标

列出不属于本 Phase 的商业能力、多语言激活、Analytics 报表或基座修改。

## 3. NuxtAdmin 接入点

~~~text
Module:
Resource:
Widget:
Custom admin page:
Server API:
Server Service:
Server Repository:
Event hooks:
Permissions:
~~~

说明是复用现有 Resource/Widget，还是新增通用 Framework Enhancement。修改 app/admin/core、app/admin/framework 或 app/admin/ui 时必须附 ADR。

## 4. 数据模型

### 4.1 Entity

~~~text
Table:
Fields:
Foreign keys:
Indexes:
Unique constraints:
Delete strategy:
~~~

### 4.2 Translation

~~~text
Table:
Entity FK:
Locale FK:
Primary Locale rule:
Required fields:
Unique constraints:
Indexes:
Public completeness rule:
~~~

如果不需要 Translation，必须写出原因。

### 4.3 Analytics（如适用）

~~~text
Raw event table:
Session table:
Rollup tables:
Retention:
PII excluded:
Indexes:
~~~

### 4.4 Migration

~~~text
Migration name:
Forward migration:
Seed/data migration:
Backward migration:
Rollback limitation:
Backup requirement:
~~~

## 5. Repository 与 Service

### 5.1 Repository

~~~text
list(...)
findById(...)
create(...)
update(...)
delete(...)
withTransaction(...)
~~~

Repository 不处理 HTTP、Vue 和页面文案。

### 5.2 Service

说明业务规则、权限语义、状态转换、跨表事务、事件和缓存失效。公开内容查询必须显式接收 locale。

## 6. Resource / Widget

~~~text
defineModule(...)
defineResource({
  name:
  model:
  permissionPrefix:
  searchable:
  table:
  form:
  infolist:
  rowActions:
  bulkActions:
})
~~~

Widget 必须说明数据 API、权限、时间范围、时区、Locale、Loading/Empty/Error 和缓存策略。

## 7. Route 与 API

~~~text
Nuxt page:
Layout:
Middleware:
SEO Meta:

Method:
Path:
Auth:
Permission:
Input Schema:
Output Schema:
Errors:
Rate limit:
Cache:
~~~

Server 检查：

~~~text
□ server/utils/* 跨文件显式 import
□ Handler 不写复杂 SQL
□ Handler 不绕过 Service
□ Server 再次执行权限
□ 错误统一映射
~~~

## 8. Analytics 专用章节

### 8.1 事件

~~~text
Event type:
Trigger:
Client fields:
Server-enriched fields:
Deduplication key:
~~~

### 8.2 隐私

~~~text
□ 是否需要 Consent？
□ 是否尊重 DNT/GPC？
□ 是否过滤 Admin/Preview/Bot？
□ 是否保存原始 IP？必须默认否
□ 是否清洗 Referrer Query？
□ 是否避免表单、Token、Authorization？
□ Retention 是否明确？
~~~

### 8.3 指标

~~~text
Page View:
Session:
Unique Visitor:
Bounce:
Entry Page:
Exit Page:
Engaged Time:
~~~

### 8.4 报表

~~~text
筛选：时间范围 / Locale / 路径 / 来源 / 设备
维度：来源 / 页面 / 设备 / 浏览器 / OS / Locale
时区：
聚合表：
权限：analytics.view / analytics.manage
~~~

## 9. 权限矩阵

| 操作 | 未登录 | Viewer | Editor | Admin | 备注 |
|---|---:|---:|---:|---:|---|
| 查看公开内容 |  |  |  |  |  |
| 查看后台列表 |  |  |  |  |  |
| 创建 |  |  |  |  |  |
| 编辑 |  |  |  |  |  |
| 发布 |  |  |  |  |  |
| 删除 |  |  |  |  |  |
| 查看 Analytics |  |  |  |  |  |
| 管理 Analytics 数据 |  |  |  |  |  |

同时测试前端 useCan、Server requirePermission 和直接访问 URL/API 的 401/403。

## 10. 多语言检查

~~~text
□ 自然语言字段进入 Translation 表
□ Entity 与 Translation 使用明确外键
□ primary_locale_id 规则明确
□ Missing / Incomplete / Complete 规则明确
□ Slug 按 Locale 唯一
□ 公开查询不跨语言 fallback
□ Cache Key 包含 Locale
□ 新增 Locale 不需要 Schema 改动
□ UI Locale 与 Content Locale 独立
~~~

## 11. 测试计划

### Unit

- Schema/Validation
- Locale Resolution
- Translation 完成度
- 权限
- Referrer/UTM/Device Parser
- Analytics 指标和 Rollup

### Integration

- Migration
- Repository 查询和事务
- Entity + Translation 原子写入
- 唯一约束
- Cache Invalidation
- Analytics 去重、限流、留存删除

### E2E

- 管理员 CRUD
- 未授权访问
- 公开 Locale 路由
- Translation 缺失时 404/隐藏入口
- Page View 采集
- 来源/页面/设备报表
- Admin、Preview、Bot 不进入统计

## 12. 验收标准

使用 Given / When / Then：

~~~text
Given ...
When ...
Then ...
~~~

必须覆盖正常、空状态、错误、404/403/401、权限、事务失败、缓存失效、多语言和 Analytics 隐私边界。

## 13. 质量闸门

~~~text
npm run lint
npm run typecheck
npm test
npm run build
npx playwright test
~~~

记录实际命令和结果，不只写“已测试”。

## 14. 发布、监控与回滚

~~~text
Migration 顺序:
Feature Flag:
环境变量:
日志指标:
告警条件:
回滚方式:
数据恢复:
~~~

Analytics Phase 额外记录采集成功率、4xx/5xx、事件去重数量、Rollup 延迟、原始表增长速度、报表查询耗时和数据删除任务结果。

## 15. 完成记录

~~~text
Phase Status: COMPLETE
Acceptance: PASS
Known Issues: NONE
Breaking Changes Allowed: NO
Follow-up: NONE
~~~

附上测试摘要、Migration 状态、变更文件、NuxtAdmin 基座 commit、已知问题和 ADR/Enhancement 链接。
