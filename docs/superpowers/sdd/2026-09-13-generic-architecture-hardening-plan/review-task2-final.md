# Task 2 独立只读审查结论

审查对象：`e724651` + `75ac98c`，基线为 `0a4ff6f`，终点为 `75ac98c`。
审查范围：仅提交范围与提交树源码/测试；未运行测试、lint、typecheck 或 build，未修改实现代码。

## Verdict

- **Spec verdict：FAIL**
- **Code quality verdict：NEEDS CHANGES**
- **Recommendation：revise**

结论：5 个 dispatcher 已经真正使用 `context.repository` 做运行时适配器选择；但 `DomainRepositoryContext.transaction` 没有进入生产 dispatcher，`memory` 也没有真正的 memory repository。测试新增了运行时导入与 driver identity 验证，却不再验证原有的 API/service 直连数据库边界，且本次审查按要求没有执行测试，因此不能判定任务满足规范。

## 主要问题

### P1 — transaction 没有真正注入生产运行时

`server/repositories/domain-context.ts:15-16` 将 `repository` 和 `transaction` 定义为可选字段；工厂只有在同时传入 `repositories` 与 `transaction` 时才创建 `context.transaction`（`server/repositories/domain-context.ts:42-47`）。

5 个 dispatcher（alias、page、post、profile、settings）只传入 `repositories`，没有传入 transaction，也没有消费 `context.transaction`。因此新增测试（`tests/unit/repository-context-boundary.test.ts:58-74`）证明的只是 fake transaction callback 能被工厂包装，不是生产事务能力已经注入。

实际事务仍由 adapter 直接创建，例如 `server/repositories/page.repository.ts:167-190` 和 `server/repositories/page.postgres.repository.ts:167-190` 分别直接调用 `getDb().transaction` / `getPostgresDb().transaction`。这与架构规范要求的 context transaction contract（`docs/architecture/通用架构设计与开发约束.md:36-47`）不一致。

### P1 — `memory` 仅被当作 MySQL 选择，不是 memory 实现

最终 context 接受四种 driver，但 `memory` 与 `mysql` 都令 `ormDriver` 为 `mysql`，并选择 `repositories.mysql`（`server/repositories/domain-context.ts:29-44`）。5 个 dispatcher 的测试也明确把 `memory` 期望为 `mysql` adapter（`tests/unit/repository-context-boundary.test.ts:77-93`）。

这修复了 `e724651` 单独引入的 `memory` 导入期拒绝问题，但没有实现规范所说的“MySQL、PostgreSQL、Supabase 和 memory 实现相同 contract”：`server/database/config.ts:20-42` 把 `memory` 归一化为 `ormDriver: 'memory'`，而 `server/plugins/blog-db.ts:20-33` 对非 PostgreSQL driver 仍启动 MySQL。该范围没有新增 memory repository，也没有将 domain context 与全局 driver 语义统一。

### P2 — 运行时测试覆盖了路由选择，但没有覆盖 context 边界

`repository-context-boundary.test.ts` 的 driver matrix 会动态导入 5 个 runtime 模块，并以导出函数 identity 验证 mysql/postgres/supabase/memory/缺省 driver 的选择；这是比源码字符串匹配更有效的运行时验证。

但它没有验证：

- dispatcher 或 service 实际消费 `context.transaction`；
- transaction rollback、分页、写入 ID 和时间映射；
- memory adapter 的实际行为；
- API/service 不再直接导入 schema 或调用 `getDb`。

同时，`e724651` 原有的直连数据库扫描测试被完全替换。最终提交树中仍可见 API/module 直连数据库调用，例如 `server/modules/advertising/ad-purchase.service.ts:3-6,26` 与 `server/api/public/advertising/slots.get.ts:2-8`。因此测试不再提供 Task 2 所称的 boundary audit 结果，只提供 5 个 staged dispatcher 的选择契约。

### P2 — context contract 过弱且依赖不安全断言

runtime 文件通过 `context.repository as typeof mysql`（例如 `server/repositories/page.runtime.repository.ts:5-12`）绕过了可选字段检查。当前 5 个调用点确实传入了两个 repository，因此这些调用点不会因缺失字段而失败；但公共工厂仍允许返回没有 repository/transaction 的 context，不能由类型保证“context 必须可用”。

## 检查矩阵

| 项目 | 结论 |
| --- | --- |
| 5 个 dispatcher 消费 `context.repository` | **通过**：5 个目标文件均通过 context 选择并读取 `context.repository` |
| repository 是否真正注入 | **部分通过**：5 个 dispatcher 注入两个 adapter namespace；service/adapter 内部仍是模块级具体 DB 依赖 |
| transaction 是否真正注入 | **不通过**：仅 fake factory 测试注入；生产 dispatcher 未传入、未消费 |
| `mysql` | **通过**：选择 MySQL adapter，行为与基线一致 |
| `postgres` | **通过**：选择 PostgreSQL adapter |
| `supabase` | **通过**：选择 PostgreSQL adapter |
| `memory` | **部分通过/规范不通过**：不再导入期抛错，但选择 MySQL，不是 memory adapter |
| 测试运行时验证 | **部分通过**：验证模块导出 identity；不验证事务、实际 DB 调用或边界扫描 |
| 提交范围 | **通过**：两次提交合计 7 个文件，只有 5 个 dispatcher、context 和专项测试；未包含 package/lock 或迁移文件 |

## 风险与恢复

- Impact：**high**。变更位于页面、文章、Alias、Profile、Settings 的共享运行时入口，影响公共和管理调用方。
- Regression likelihood：**high**。事务 contract 未接通，driver 语义存在分裂，且本审查没有执行相关检查。
- Regression protection：**partial**。有运行时 adapter identity matrix，但没有真实数据库、事务回滚或完整边界保护。
- Recoverability：**easy**。没有 schema/migration 或持久化格式变更，回退这两个提交即可恢复原选择逻辑；但不能把回退当作规范修复。
- Status-quo risk：**high**。不合并会保留 dispatcher 的分散 driver 判断；合并当前版本则会把不完整的 context contract 固化为测试契约。

## 只读证据摘要

- 提交范围：`0a4ff6f..75ac98c`，7 个文件；patch SHA-256：`ac3e669abdbe40bfbfe41c1de4d91d2f046614c6f3752859de932f38eb8743fe`。
- `git diff --check 0a4ff6f 75ac98c` 无输出。
- 未执行测试、lint、typecheck、build；因此不对任何运行结果作通过声明。
