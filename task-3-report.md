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

## 修复轮次 2

- 统一 unit/API mock 与生产媒体 URL 契约：媒体 ID 先解析到 `storageKey`，公开 URL 使用 `/media/{storageKey}`，不再使用 `/media/{id}`。
- 按 Task 3 简报明确的 archive cover 要求，补齐归档仓储的实体/旧翻译封面回退、服务层逐条 `coverUrlFor()` 映射、`PublicArchiveItem.coverUrl` 类型及归档页面消费。
- 保留现有一次性归档查询，不引入逐页重型查询；增加多条归档逐项映射和调用次数回归。
- 增加公开列表与详情的 `en` locale 查询契约测试，并保留创建、清空和详情封面回归。

本轮验证：

- `npm test -- --run tests/unit/post-public-cover.test.ts`：7/7 通过。
- `npm run lint -- --quiet`：通过。
- `npm run typecheck`：通过。
- Playwright：未执行。仓库当前未安装 `@playwright/test`，也没有 Playwright 配置或 `playwright`/`playwright-cli` 可执行文件；没有改动依赖或锁文件。

## Concerns

- 真实 MySQL、管理员认证和浏览器回归仍需在具备对应运行环境后执行；E2E spec 会在无媒体前置数据时显式失败，不会静默跳过。
- 工作区存在大量既有用户改动，本任务只提交 Task 3 文件及本报告。

## 修复轮次 1

- E2E 特色图断言改用媒体 API 返回的 `storageKey`，与生产 `coverUrlFor()` 的 `/media/{storageKey}` 契约一致。
- 根据现有归档页面和 `PublicArchiveItem` 设计，撤回归档 `coverUrl` 扩展；归档继续使用既有一次性 `listPublishedArchive()` 查询，不引入逐页重型查询。
- 增加多条归档结果保留/单次查询回归，以及英文 locale 传递回归。

本轮验证：

- `npm test -- --run tests/unit/post-public-cover.test.ts`：5/5 通过。
- `npm run lint -- --quiet`：通过。
- `npm run typecheck`：通过。

## 公共多语言修复轮次 1（review-task3）

- 纳入公共 URL 依赖 `useLocale`、locale middleware、`localizedPath`、受控 display-label resolver 及 localized route 入口，确保提交树可独立构建；未修改后台 UI 或数据仓库。
- 修复语言切换契约：URL locale 优先于 cookie，`/en` 深链规范化为 `/en`，切换保留路径、查询和 hash，并原样保留外部 URL。
- 实际接入首页布局、文章列表/卡片、PostList、PostDetail、SiteFooter、NavigationMenu 和 LanguageSwitcher 的翻译与 locale-aware 链接；文章标题/正文继续由请求 locale 独立决定。
- 导航公开解析链使用受控 fallback：英文优先使用本地化 label，其次 alias、system key，最后默认 label；缺失 locale 内容仍隐藏目标项。
- 将公共 i18n 覆盖改为运行时行为测试，新增导航服务链测试和文章标题/正文 locale 独立性测试。

本轮报告与验证结果在收尾阶段补录：focused tests、audit:i18n、lint、typecheck 及提交状态以最终命令输出为准；audit:i18n 预期仍报告后台动态 key/硬编码问题，按 Task 5 范围保留。
