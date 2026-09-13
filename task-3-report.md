# Task 3：特色图片 API 与公开页面回归

日期：2026-09-13

## 实现

- 公开归档复用文章实体级 `coverMediaId`，分页读取已发布文章，并为每个归档条目调用一次 `coverUrlFor()`。
- 保留文章创建、更新、公开摘要和详情的 `featuredMediaId` / `coverUrl` 契约；显式更新为 `null` 会清空封面。
- 后台文章 GET/PUT 当前已是鉴权后直接转发服务返回值与原始请求体，本任务未对其增加无效包装。
- 新增 API/公开映射单测和管理员浏览器流程 spec；未修改 `MediaPicker`。

## 验证

- `npm test -- --run tests/unit/post-public-cover.test.ts`：通过，1 个测试文件、4 个测试。
- `npm run lint -- --quiet`：通过。
- `npm run typecheck`：通过。
- Playwright：未执行。仓库当前未安装 `@playwright/test`，也没有 Playwright 配置或 `playwright`/`playwright-cli` 可执行文件；没有改动依赖或锁文件。

## Concerns

- 真实 MySQL、管理员认证和浏览器回归仍需在具备对应运行环境后执行；E2E spec 会在无媒体前置数据时显式失败，不会静默跳过。
- 工作区存在大量既有用户改动，本任务只提交 Task 3 文件及本报告。
