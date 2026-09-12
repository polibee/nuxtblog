# Nuxt Admin 项目开发约束

本文件是 Codex 在本仓库中进行开发、审查和排障时必须遵守的项目级规则。用户的明确要求优先于本文件；本文件优先于通用默认行为。

## 1. 项目定位与技术基线

- 项目是基于 Nuxt 4、Vue 3.5、TypeScript 的声明式后台管理框架与 CMS。
- UI 使用 Tailwind CSS v4、shadcn-vue 风格组件、Reka UI 和 Lucide 图标。
- 数据表格使用 TanStack Table Vue；表单使用 VeeValidate + Zod；富文本使用 Tiptap；客户端状态使用 Pinia。
- 服务端使用 Nitro/H3；数据访问通过仓储与 `server/utils` 抽象层。当前仓库存在两条数据路径：通用 `server/utils/store` 支持 memory/PostgreSQL/Supabase/MySQL，但现有博客领域仓储仍是 MySQL；不得把切换 `DB_DRIVER` 宣称为全站数据库迁移完成。
- 包管理器固定使用 npm，提交时保持 `package-lock.json` 与 `package.json` 一致。
- 不要为了临时通过检查而随意升级、降级或替换依赖版本。

## 2. 目录职责与依赖方向

- `app/modules/**`：业务模块、业务资源、业务页面和业务组件。新增业务优先放在这里。
- `app/admin/**`：通用管理框架层，包括类型、注册中心、Resource/Module 定义器、Schema DSL、表格/表单/详情/Action 引擎和通用 UI。业务需求不得直接污染此层。
- `app/pages/**`：公共页面与管理入口；`app/pages/admin/[...path].vue` 负责管理资源路由分发。
- `app/plugins/admin.ts`：管理端组合根；新增模块必须在这里显式注册。
- `app/layouts/**`、`app/stores/**`、`app/composables/**`：应用壳层、会话/UI 偏好和可复用前端逻辑。
- `server/api/**`、`server/routes/**`：HTTP 端点与公开资源路由。
- `server/repositories/**`：数据库 schema、仓储和迁移相关代码。
- `server/utils/**`：服务端业务基础设施，如认证、权限、CRUD、缓存、事件、邮件、存储和安全工具。
- `shared/schemas/**`、`shared/types/**`、`shared/utils/**`：前后端共享契约与纯函数。
- `tests/unit/**`、`tests/e2e/**`：单元测试与关键链路测试。
- `docs/**`：设计、阶段记录、ADR 和参考材料；除非任务明确要求，不要把文档参考代码当作运行时代码。

依赖方向应保持为：

```text
页面/业务模块 → admin 框架能力 → shared 契约
服务端 API → server utils/repositories → shared 契约
```

禁止让通用框架反向依赖具体业务模块；禁止让客户端直接访问数据库或复用服务端实现。

## 3. Resource、Module 与 Schema 规范

- 业务资源使用 `defineResource` 声明，模块使用 `defineModule` 声明；不要为单个资源重复实现 CRUD 页面。
- 一个资源的 `name` 同时是 URL/API slug，必须稳定、唯一，并与服务端资源配置一致。
- 新资源应完整考虑 `label`、`labelPlural`、`group`、`sort`、`permissionPrefix`、`searchable`、`table`、`form`、`infolist` 和 Action。
- 所有面向用户的资源标题、字段、列、Action、通知和导航文本必须走 `Translator`/i18n；不得新增中英文混排或硬编码业务文案。
- Schema 必须是纯数据描述，由通用渲染器负责渲染；不要在资源定义中重复实现表单、表格或详情布局。
- 表单校验以 Zod 为准。创建和更新的语义要区分：创建校验必填字段，更新只校验实际提交的字段。
- 新增字段类型必须同步更新：`app/admin/core/types.ts`、`schemaToZod.ts`、`FormField.vue`、字段构建器和对应单测。
- 自定义 Action 必须声明权限；修改数据后必须发出 `{resource}:refresh` 管理事件，让列表重新加载。
- `ActionContext.resource` 必须存在；`record`、`ids`、`values` 按动作来源按需使用。
- 表格状态统一由 `useResourceTable` 管理。组件不得直接修改 props 或内部 ref，必须调用 composable 提供的变更方法。
- 资源页面覆盖只能使用 Resource 契约中已有的 `pages.list`、`pages.view`、`pages.raw` 扩展点，并遵守对应权限门控；不要为设置类子页面制造伪资源或依赖 query 参数堆叠页面状态。
- 动态内容资源统一使用 `ct_` 前缀；slug 由服务端生成后保持不可变。

## 4. 服务端、数据与 API 约束

- 每个管理端 handler 必须在业务逻辑前调用 `requireUser` 或 `requirePermission`；前端权限过滤只是体验层，不能替代服务端鉴权。
- 权限命名使用 `{permissionPrefix}.{view|create|edit|delete}`；自定义操作沿用资源权限或声明明确的额外权限。
- 请求体、查询参数、路径参数和动态配置必须在服务端验证、归一化和限长；优先复用 `shared/schemas` 与 `server/utils/resourceConfigs.ts`。
- 数据访问必须通过仓储或既有 `server/utils` 抽象，不能在 API 文件中散落 SQL、内存集合或重复查询逻辑。
- SQL 必须参数化；不得把用户输入直接拼进 SQL、命令、文件路径、URL 或 HTML。
- 变更数据库 schema 时必须生成与目标数据库匹配的 Drizzle migration，并检查迁移顺序、默认值、索引、外键和旧数据兼容性。Supabase/PostgreSQL 迁移完成前，不得直接复用 MySQL 方言迁移。
- 配置了非 memory 数据库时，连接失败不得静默回退到内存；只有明确设置 `ALLOW_MEMORY_FALLBACK=true` 才允许该行为。远程数据库配置必须使用 SSL，并禁止提交连接串、密码或 service-role key。
- 保持错误语义稳定：未登录返回 401、无权限返回 403、校验失败返回 422、业务冲突返回 409；不要把内部异常和密钥写入响应。
- 事件总线用于跨模块解耦。`before*` 事件可否决操作，`after*` 事件不得让核心 CRUD 依赖外部通知成功；通知/ webhook 失败应隔离并记录。
- 涉及缓存的数据变更必须考虑事件驱动失效；不能只更新数据库而留下明显陈旧的公开页面缓存。
- 金额使用最小货币单位整数保存和传输，货币代码必须显式；禁止使用浮点数表达金额。
- 媒体文件通过 Nitro storage 管理，删除记录时同步清理存储对象；上传必须限制大小、MIME、扩展名和文件名，不能信任客户端提供的路径。

## 5. 安全红线

- 富文本进入存储前必须经过服务端白名单清洗；禁止直接把未经清洗的用户 HTML 交给 `v-html` 或持久化。
- 外发 URL（Webhook、图片、回调等）必须经过协议、主机、解析地址和私网/回环地址校验；不能仅用字符串前缀判断 SSRF 安全。
- 密码使用现有密码哈希工具；会话 token 只保存哈希，cookie 保持 `httpOnly`、合理的 `sameSite`，生产 HTTPS 开启 `secure`。
- API key、SMTP 密码、支付凭据、加密密钥等敏感值不得写入源码、测试样例、日志、提交信息或客户端响应；配置回显只允许布尔状态或掩码提示。
- Webhook 等签名必须对精确请求体进行 HMAC-SHA256；重试必须有退避、上限和可观测错误。
- 所有登录、密码重置、公开评论、AI 调用和高成本外部请求都要考虑速率限制、输入上限和超时。
- 重定向只允许站内相对路径；外部跳转必须显式、受控且经过审查。
- 修改认证、权限、支付、文件上传、Webhook、富文本、导出/备份或动态资源时，必须补充针对性安全测试。

## 6. 前端与交互约束

- 优先复用 `app/admin/ui/Ui*` 和 `app/admin/framework` 现有组件；新增基础控件前先确认没有可复用组件。
- 遵循现有 Tailwind、CSS 变量、主题和响应式布局，不要引入新的 UI 框架或平行设计系统。
- 图标使用 `lucide-vue-next` 及 `app/admin/utils/iconMap.ts` 支持的键；不要直接写不可维护的 SVG 字符串。
- 加载、空状态、校验错误、权限不足、网络错误和成功反馈必须有明确 UI；异步提交期间要禁用重复操作。
- 公共页面与后台页面都要考虑 SSR、无障碍、移动端布局和深链刷新。
- Tiptap、浏览器 API、文件对象和其他仅客户端能力必须避免在 SSR 阶段执行。
- AI 功能遵守“预览 → 用户确认 → 应用”流程；不得在用户未确认时直接覆盖编辑器内容或写入数据库。

## 7. 测试与提交前质量闸门

完成任何代码改动后，按改动风险运行相应检查；准备交付前必须依次通过：

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

- 纯函数、Schema、权限、查询、序列化、清洗、签名和边界逻辑优先补 `tests/unit/**` 单测。
- 跨页面、认证、权限、CRUD、支付、媒体和关键业务流程补 E2E 或可重复的接口验证。
- 修复 bug 时先添加能复现问题的回归测试，再修改实现。
- 不得用 `any`、关闭 ESLint/TypeScript 规则、跳过测试或放宽校验来掩盖问题；确需例外时必须说明范围和原因。
- 生产构建必须实际通过；不能只依据开发服务器能启动就宣称完成。
- 若检查失败，报告真实失败项、首个相关错误和未验证部分，不要声称“全部通过”。

## 8. 本地运行与网络规则

- 在 WSL2 中安装依赖、下载资源或 clone 前先运行 `wslnet ctx`，按其 `recommend` 使用网络配置。
- 遇到网络失败先执行 `wslnet fix`，然后只重试原命令一次；仍失败时执行 `wslnet doctor` 并保留诊断信息。
- 不要在 WSL 中使用指向 Windows 的 `127.0.0.1` 代理，也不要手改 npm、git、pip 或 apt 的代理配置。
- 开发服务器必须后台启动并落日志、记录 PID，例如：

  ```bash
  nohup npm run dev -- --host 0.0.0.0 > /tmp/nuxtblog-dev.log 2>&1 & echo $! > /tmp/nuxtblog-dev.pid
  ```

- 告知用户访问地址前，先用 `wslnet url <port>` 验证 Windows 侧可访问；对外统一报告 `http://127.0.0.1:<port>/`，不要报告 `localhost`。
- 不要把 `.data/`、`.output/`、临时补丁、密钥和本地数据库文件提交到仓库。

## 9. Git 与工作区纪律

- 开始修改前先检查 `git status --short`；工作区已有的改动属于用户，必须保留。
- 不要使用 `git reset --hard`、`git checkout --`、批量删除或清理命令覆盖用户改动，除非用户明确要求并确认目标。
- 只编辑完成当前任务所需的文件；不要顺手格式化、重命名或重构无关代码。
- 新增功能涉及架构选择、公共契约或持久化格式时，补充对应 ADR 或设计文档；不要仅靠代码注释记录重要决策。
- 交付时说明修改文件、验证命令及结果，并明确列出因环境、依赖、数据库或未提交改动而未完成的验证。

## 10. 常用参考入口

- 项目概览与命令：`README.md`
- 资源/模块/Schema 设计：`docs/开发指南.md`（若当前工作区被删除，可参考 Git HEAD 版本）
- 架构和历史决策：`docs/Blog-Framework-v1.0-nuxtadmin-architecture.md`、`docs/adr/**`
- 阶段实现与验收：`docs/phases/**`
- 服务端通用 CRUD：`server/utils/crud.ts`
- 资源服务端配置：`server/utils/resourceConfigs.ts`
- 共享校验：`shared/schemas/**`
