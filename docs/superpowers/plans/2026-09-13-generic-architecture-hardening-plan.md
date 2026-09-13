# Generic Architecture Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) to implement this plan task-by-task. Each task requires focused tests, review, and a separate commit.

**Goal:** 将本项目中反复出现的边界、国际化、URL、异步和测试问题固化为可复用的架构标准。

**Architecture:** 以模块契约、Repository context、统一 resolver、模块化 locale bundle 和质量闸门为核心。文档规范先行，运行时代码按独立任务逐步对齐，禁止跨模块大爆炸重构。

**Tech Stack:** Nuxt 4, Vue 3, TypeScript, Nitro/H3, Drizzle ORM, MySQL/PostgreSQL adapters, Vitest, ESLint, vue-tsc。

**Spec:** `docs/architecture/通用架构设计与开发约束.md`

## Global Constraints

- 不覆盖用户已有未提交改动。
- 页面不得直接访问数据库；服务端数据访问必须经过 repository/context。
- 中文为默认语言，英文名称为空时使用 Alias 或系统英文标识；文章内容语言独立维护。
- 401/403/422/409/503 错误语义保持稳定。
- 外部 URL、富文本、Webhook、AI、评论和导出必须经过安全校验。
- 金额使用最小货币单位整数；迁移必须与目标数据库方言匹配。
- 每个任务独立测试、审查和提交；未执行的真实环境验证不得宣称通过。

---

### Task 1: 文档与 ADR 基线

**Files:**
- Create: `docs/architecture/通用架构设计与开发约束.md`
- Create: `docs/adr/0007-generic-architecture-boundaries.md`
- Modify: `AGENTS.md`, `README.md`
- Test: `tests/unit/architecture-docs.test.ts`

**Interfaces:**
- Produces: 统一分层、context、resolver、i18n、错误、异步和质量闸门规则。

- [ ] 写文档存在性、关键章节和禁止项测试。
- [ ] 更新 AGENTS/README 的文档入口，不复制冲突规则。
- [ ] 运行 focused test、lint、typecheck 并提交。

### Task 2: Repository Context 对齐审计

**Files:**
- Inspect/Modify: `server/repositories/*`, `server/modules/*`, `server/api/*`
- Create: `tests/unit/repository-context-boundary.test.ts`

**Interfaces:**
- Consumes: `DomainRepositoryContext` 规范。
- Produces: 模块不得从 service/API 直接调用具体数据库连接的审计结果。

- [ ] 先写扫描测试，识别 API 中的直连 schema/getDb 调用。
- [ ] 按模块逐步替换为 context，保留 MySQL 现有行为。
- [ ] 覆盖事务、分页、时间和插入 ID 映射。
- [ ] 运行 focused test、lint、typecheck 并提交。

### Task 3: Alias、URL 和多语言显示标准

**Files:**
- Inspect/Modify: `shared/utils/display-label.ts`, `shared/utils/locale-navigation.ts`, `server/utils/contentUrl.ts`
- Create: `tests/unit/url-locale-contract.test.ts`

**Interfaces:**
- Consumes: Alias resolver 和 locale fallback 规则。
- Produces: 导航、SEO、站点地图和公开卡片统一使用 resolver。

- [ ] 测试英文名称→Alias→系统标识、中文 fallback、301 和冲突语义。
- [ ] 统一调用方，禁止公开页面拼接管理 URL。
- [ ] 验证 locale 切换同步 URL 和数据请求。
- [ ] 运行 focused test、lint、typecheck 并提交。

### Task 4: 异步生命周期与缓存审计

**Files:**
- Inspect/Modify: `app/composables/*`, `app/components/*`, `server/utils/*`
- Create: `tests/unit/async-lifecycle-contract.test.ts`

**Interfaces:**
- Produces: request identity、AbortError、错误反馈和缓存失效的统一测试辅助工具。

- [ ] 为现有媒体、语言切换和列表请求增加 stale response 回归。
- [ ] 验证卸载后无状态写入、emit 或未处理 rejection。
- [ ] 验证核心 CRUD 成功不依赖通知/Webhook 成功。
- [ ] 运行 focused test、lint、typecheck 并提交。

### Task 5: 质量闸门与最终审计

**Files:**
- Modify: `package.json`, CI/workflow files if present
- Create: `scripts/audit-architecture.*`, `tests/unit/quality-gates.test.ts`

**Interfaces:**
- Consumes: Tasks 1-4 的契约和测试。
- Produces: 可重复的 lint/typecheck/test/build 入口和审计报告。

- [ ] 增加只读 source audit，输出固定格式的违规文件和行号。
- [ ] 检查 npm scripts 与锁文件一致，不升级无关依赖。
- [ ] 依次运行 `npm run lint`、`npm run typecheck`、`npm test -- --run`、`npm run build`。
- [ ] 记录真实 MySQL、浏览器和外部服务未验证项。
- [ ] 独立审查后提交最终报告。
