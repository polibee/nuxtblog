# Task 2 最终只读审查报告

## 审查对象

- 仓库：`D:\\codex\\nuxtblog`
- 补丁文件：`.superpowers/sdd/2026-09-13-featured-image-localization-audit-plan/review-e7b4fd5..10b5d03.diff`
- 基线 / 头：`e7b4fd5` → `10b5d03`
- 补丁 SHA-256：`93a35e597956bd1d8ae1627acb6a7783171a36619c8f590397eeae5059ef508f`
- 补丁声明的文件：
  - `.superpowers/sdd/2026-09-13-featured-image-localization-audit-plan/task-2-report.md`
  - `app/admin/framework/MediaPickerField.vue`
  - `tests/unit/media-picker-field.test.ts`
  - `tests/unit/post-resource.test.ts`
- 执行限制：按请求未运行测试、lint、typecheck 或 build；仅执行了静态源码/补丁检查及 `git diff --check`。

## Verdict

- **Spec verdict：REVISE**
- **Code quality verdict：REVISE**
- **Recommendation：`revise`（workflow label：`revise`）**

补丁已经解决了主要的分页外媒体回显问题，并对 selected-media、分页和文件夹列表请求加入了 AbortError 分类、请求身份检查、卸载检查和真实 Vue 挂载式 DOM 断言。非 AbortError 也不再被静默吞掉，而是通过 `role="alert"` 显示原始错误或翻译 fallback。

但生命周期保护没有覆盖上传与建文件夹的 POST 流程：组件卸载后，这两个请求仍会继续，并可能在 await 返回后向已卸载组件发出 `update:modelValue` 或写入响应式状态。这是源代码可直接证明的生命周期竞态，不能给出通过结论。

## Findings

### [P1] 上传/建文件夹在卸载后仍执行 stale side effects

位置：`app/admin/framework/MediaPickerField.vue:303-320`、`:323-339`、`:430-438`。

`onBeforeUnmount()` 会取消 page、folder、selected-media controller，但 `onUpload()` 和 `createFolder()` 发起的 POST 没有自己的 `AbortController`，也没有在每个 await 之后检查 `disposed`：

- 上传完成后无论组件是否已卸载，都会执行 `emit('update:modelValue', created.id)` 和 `open.value = false`；
- 建文件夹完成后无论组件是否已卸载，都会写入 `newFolderName.value`、`folderFilter.value`，再调用 `reload()`。

因此“所有生命周期入口都有安全边界”的结论不成立。`runAsync()` 只处理 rejection，不阻止成功响应的 stale side effect。正常的页面离开、资源切换或父组件条件渲染都可以触发该窗口。

建议为上传和建文件夹分别绑定可取消 controller，并在每个异步阶段及最终 emit/写状态前检查 `disposed` 与请求身份；若产品选择不取消 POST，也必须在成功响应后阻止卸载组件的状态写入和 emit。

### [P2] 非 AbortError 的错误可在请求已过期或组件已卸载后写入 `loadError`

位置：`app/admin/framework/MediaPickerField.vue:246-255`。

非 AbortError 正确地被重新抛出并进入 `handleAsyncError()`，这满足“不静默吞掉真实错误”的要求。但 `handleAsyncError()` 没有检查 `disposed` 或请求身份。若旧的 detail/page/folder 请求以普通 `Error` 失败，而新请求已经接管，旧错误仍会覆盖当前 `loadError`；若组件已卸载，错误也会继续修改组件 ref。

这不是 AbortError 的误分类，而是错误展示状态缺少生命周期/请求身份绑定。建议由每个入口携带 operation token，只有当前且未 disposed 的操作才能更新 `loadError`；真实非 AbortError 仍应保留可见错误反馈。

### [P2] DOM 测试是真实 Vue/SFC 挂载，但不是浏览器级 DOM 集成测试

位置：`tests/unit/media-picker-field.test.ts:45-181`、`:231-307`。

正面证据：测试编译实际 `MediaPickerField.vue` 的 script/template，使用 `createApp`、实际 `onMounted`/`watch`/`onBeforeUnmount`，并断言 filename、image `src`、image `alt`、真实 button click 及 emit payload；AbortError、ID 切换、loadMore 和卸载路径也有覆盖。

限制是测试依赖约 140 行自定义 `FakeNode`/`FakeElement`，`querySelector` 只支持很小的选择器子集，且通过 `new Function` 拼装 SFC setup/render。它能证明当前组件在这个 fake DOM 模型下的关键行为，但不能替代 jsdom/happy-dom/浏览器对事件、属性、节点类型和 FormField 集成的验证。测试也没有覆盖上传/建文件夹的非 AbortError 与卸载竞态，因此无法阻止 Finding P1 回归。

### [P2] 补丁包含 brief 未列出的 task report 文件

Task 2 brief 的 Step 6 只列出源码、资源、详情路由和两个测试文件；本补丁还新增了 `.superpowers/.../task-2-report.md`。该文件属于同一任务目录、没有运行时影响，且作为任务交付记录是合理的，但严格按 brief 的“commit only this task / git add”清单，它是范围偏差。若仓库流程要求报告随任务提交，应将该约定明确写入 brief；否则应从任务提交中移出。

## 对照检查

| 检查项 | 结论 | 证据 |
|---|---|---|
| 分页外编辑回显 | 满足核心场景 | `reload()`/`loadMore()` 成功后调用 `rehydrateSelectedMedia()`；正整数 ID 缺失时请求 `/api/admin/media/:id` 并合并到 `items`。 |
| selected-media AbortError | 满足 | `rehydrateSelectedMedia()` 对 AbortError 返回；ID 切换、清除、卸载会 abort，并检查 `disposed`、signal、当前 ID、重复项。 |
| page/folder AbortError | 满足 | `fetchPage()`/`fetchFolders()` 对 AbortError 返回，并有 controller identity 与 disposed 检查。 |
| 非 AbortError | 基本满足但有 stale-error 风险 | detail/page/folder 会 rethrow，所有入口经 `runAsync()` 进入可见错误状态；但 `loadError` 未绑定请求身份/生命周期。 |
| 成功响应生命周期竞态 | 部分满足，需返修 | page/folder/detail 有 guards；upload/createFolder 成功后的 emit/写状态没有 guard。 |
| 初始 reload / loadMore 竞态 | 满足核心场景 | page request identity、requested page、post-await checks，以及对应 DOM 回归存在。 |
| 选择/清除契约 | 满足 | `select()` 发出数字 ID，`clear()` 发出 `null`；DOM 测试观察两个 payload。 |
| DOM 测试 | 部分满足 | 实际 Vue runtime 与编译模板已挂载，但依赖自定义 fake DOM，非浏览器级集成。 |
| i18n | 满足当前 Task 2 要求 | MediaPicker 新增文案均通过 `t()`；PostResource 使用 `t('res.posts.help.featuredImage')`，中英文 key 在基线已有；测试验证 exact lookup 与中文 hint。原始服务端错误 message 仍可能是非本地化文本。 |
| PostResource 字段 | 满足 | `e7b4fd5` 基线已使用顶层 `featuredMediaId`；本增量只增强其测试。 |
| 详情 API | 满足且未被本增量修改 | 既有 route 先执行 `requirePermission(event, 'media.view')`，再校验正整数 ID 并调用 `getMediaItem`。 |
| 运行时范围 | 基本受控 | 运行时只改共享 `MediaPickerField`；额外 report 为文档文件，测试改动较大但未引入生产依赖。 |

## 风险评估

- **影响：moderate**。变更触及共享后台媒体选择器；P1 主要造成卸载后的 stale emit/状态写入，不直接改变数据库持久化，但可能污染父表单状态或产生不可预测 UI 行为。
- **回归可能性：high**。上传、建文件夹与组件卸载是正常可发生的异步交错；相关 side effect 没有源代码 guard，且测试未覆盖。
- **回归保护：partial**。回显、DOM 属性、选择/清除、AbortError 和若干请求竞态有测试；但 exact-head 检查按请求未运行，上传/建文件夹生命周期、stale non-AbortError、FormField/API 保存边界未覆盖。
- **可恢复性：easy**。问题局限在前端组件，可小范围修复或回滚，不涉及迁移和持久化格式。
- **审查置信度：high**。已固定补丁 hash，核对 base/head、计划、brief、变更文件、运行时调用点和已有 API/资源契约；未运行测试是明确的验证限制。
- **状态 quo 风险：moderate**。不合入会保留分页外特色图片编辑回显缺陷；合入当前版本则增加卸载期间 stale side effect 风险。

## 建议返修项

1. 为 upload/create-folder 请求增加取消或 operation identity，并在卸载后禁止 emit、ref 写入和后续 reload side effect。
2. 让 `loadError` 更新绑定当前 operation 且忽略已卸载组件的错误状态写入；保留非 AbortError 的可见错误语义。
3. 补充真实 DOM 测试对上述生命周期竞态的覆盖；至少分别验证 upload/create-folder 在卸载后的成功响应不会 emit/写状态，以及非 AbortError 仍显示 alert。
4. 明确 `task-2-report.md` 是否属于允许的任务交付文件；若不属于，应移出该任务补丁。

## 结构化评估

```json
{
  "schemaVersion": 1,
  "patch": {
    "repository": "D:\\codex\\nuxtblog",
    "sourceType": "patch_file",
    "base": "e7b4fd5",
    "head": "10b5d03",
    "changedFiles": [
      ".superpowers/sdd/2026-09-13-featured-image-localization-audit-plan/task-2-report.md",
      "app/admin/framework/MediaPickerField.vue",
      "tests/unit/media-picker-field.test.ts",
      "tests/unit/post-resource.test.ts"
    ],
    "sha256": "93a35e597956bd1d8ae1627acb6a7783171a36619c8f590397eeae5059ef508f"
  },
  "recommendation": "revise",
  "workflowLabel": "revise",
  "impact": {
    "rating": "moderate",
    "rationale": "The patch changes a shared admin media picker; stale upload or folder-creation side effects can affect a live parent form, but the change does not directly alter persisted data."
  },
  "regressionLikelihood": {
    "rating": "high",
    "rationale": "Unmount during upload or folder creation is a normal async interleaving, and the source lacks a disposed or operation-identity guard before its post-await side effects."
  },
  "regressionProtection": {
    "rating": "partial",
    "rationale": "Relevant Vue DOM, hydration, abort, race, and emit assertions exist, but lifecycle coverage omits upload/folder creation and exact-head checks were not run by request.",
    "exactHeadChecksPassed": false
  },
  "recoverability": {
    "rating": "easy",
    "rationale": "The defect is isolated to a front-end component and can be corrected or reverted without migration or persisted-state cleanup."
  },
  "confidence": {
    "rating": "high",
    "rationale": "The exact patch identity, base/head, changed files, plan/brief, runtime callers, component guards, tests, and existing resource/API contracts were inspected directly."
  },
  "applicability": {
    "status": "confirmed",
    "rationale": "MediaPickerField is a live shared admin control used by declarative resource forms and direct module admin pages, including the post featured-media editor."
  },
  "statusQuoRisk": {
    "rating": "moderate",
    "rationale": "Without the patch, off-page featured media remains invisible during editing; with the patch, unguarded upload/folder completion can act after the picker is gone."
  },
  "autoMergeExclusions": ["other"],
  "affectedRuntimeRoots": [
    "app/admin/framework/MediaPickerField.vue",
    "app/admin/framework/FormField.vue",
    "app/modules/posts/admin/PostResource.ts",
    "server/api/admin/media/[id].get.ts"
  ],
  "importantCallers": [
    "MediaPickerField onMounted reload",
    "MediaPickerField search/folder-change reload",
    "MediaPickerField openPicker/loadMore handlers",
    "MediaPickerField upload and createFolder handlers",
    "FormField mediaPicker branch"
  ],
  "riskDrivers": [
    "onUpload and createFolder POST requests are not abortable on unmount",
    "post-await upload/create-folder side effects do not check disposed or request identity",
    "handleAsyncError can write loadError for stale or disposed operations",
    "custom DOM harness does not cover upload/create-folder lifecycle behavior",
    "the task report file is outside the brief's explicit git-add list"
  ],
  "protectiveFactors": [
    "selected-media, page, and folder fetches classify AbortError separately",
    "page/folder/detail successful responses check disposed state and request identity",
    "selected-media detail checks the current modelValue before merging",
    "DOM tests assert filename, src, alt, clear/select emits, and rejected AbortError paths",
    "PostResource uses the top-level featuredMediaId and a Translator-backed hint",
    "the existing media detail route enforces media.view permission"
  ],
  "materialBoundaries": [
    {
      "id": "selected-media-rehydration",
      "invariant": "Only the current positive modelValue may be merged into the live picker, including when it is outside the current page.",
      "runtimeRoot": "MediaPickerField rehydrateSelectedMedia",
      "counterexample": "A late detail response for ID 12 must not reinsert ID 12 after the field changes to ID 13 or null.",
      "legitimateControl": "The response checks disposed, signal.aborted, current modelValue, and duplicate item identity before merging.",
      "result": "supported"
    },
    {
      "id": "request-cancellation",
      "invariant": "Replacing or cancelling page, folder, or selected-media requests must not mutate state or create an unhandled rejection.",
      "runtimeRoot": "MediaPickerField fetchPage/fetchFolders/rehydrateSelectedMedia",
      "counterexample": "Unmount or search replacement aborts a request and the underlying fetch rejects with AbortError.",
      "legitimateControl": "Each of these fetch paths catches AbortError, checks request identity/disposed state, and the entry points use runAsync.",
      "result": "supported"
    },
    {
      "id": "async-error-visibility",
      "invariant": "Non-AbortError failures must remain observable without becoming unhandled rejections or being silently swallowed.",
      "runtimeRoot": "MediaPickerField runAsync/handleAsyncError",
      "counterexample": "The initial media page request fails with a normal Error while no picker selection exists.",
      "legitimateControl": "runAsync catches the rethrown error and renders loadError in role=alert with the original message or translated fallback.",
      "result": "supported"
    },
    {
      "id": "unmount-side-effects",
      "invariant": "No asynchronous media operation may emit or write component state after onBeforeUnmount.",
      "runtimeRoot": "MediaPickerField onUpload/createFolder",
      "counterexample": "The component unmounts after upload or folder-creation POST begins but before its response resolves.",
      "legitimateControl": "onBeforeUnmount cancels page/folder/detail requests, but upload/createFolder have no controller or post-await disposed check before emit/ref writes.",
      "result": "contradicted"
    }
  ],
  "validation": [
    {
      "name": "Focused MediaPickerField and PostResource tests",
      "status": "skipped",
      "protects": "Hydration, DOM rendering, request races, AbortError handling, selection/clear events, and top-level featuredMediaId resource shape; not run per review request."
    },
    {
      "name": "Lint, typecheck, build, and full test suite",
      "status": "skipped",
      "protects": "Static, production integration, and broader regression correctness; not run per review request."
    },
    {
      "name": "git diff --check",
      "status": "passed",
      "protects": "Whitespace and patch formatting errors in the e7b4fd5..10b5d03 commit range."
    }
  ],
  "unknowns": [],
  "evidencePlan": []
}
```

## 返修记录（2026-09-13）

针对 Finding P1，本次仅修改以下三个文件：

- `app/admin/framework/MediaPickerField.vue`
- `tests/unit/media-picker-field.test.ts`
- `review-5-report.md`

修复内容：

- 上传和建文件夹 POST 分别使用独立的 `AbortController`，并在 `onBeforeUnmount()` 中取消。
- POST 成功响应、后续 `reload()`、`emit`、响应式状态写入和 `finally` 清理均检查组件生命周期及当前请求身份。
- 已卸载组件不再更新 `loadError`；`reload()` 在卸载后直接返回，避免同步写入分页状态。
- 测试覆盖上传/建文件夹成功响应在卸载后的 stale side effect，以及两类 POST 的 AbortError 无 unhandled rejection。

验证结果：

- `npm test -- tests/unit/media-picker-field.test.ts`：14/14 passed，退出码 0。
- `npm run lint`：退出码 0，0 errors；20 条 warning 来自其他既有文件。
- `npm run typecheck`：退出码 0。
- `git diff --check`：目标文件通过。

Finding P1 已按本次目标关闭。报告中关于请求替换时非 AbortError 的 stale `loadError` 身份绑定仍属于未纳入本次范围的 P2；本次只增加了卸载后的错误写入保护。由于当前环境的 WSL 入口返回 `Wsl/Service/E_ACCESSDENIED`，验证命令使用已授权的 PowerShell 工作区执行。
