# ADR 0005：RichTextEditor 编辑器 AI（Selection AI）

日期：2026-09-11（P28 AI 集成 v1）

## 背景

docs/ai集成.txt 定义了 Editor AI：选中文本 → AI 操作（润色/改写/缩短/扩写/语法/更清晰/语气/总结/翻译/自定义）→ Preview → Replace / Insert Below。AI 永不直接改库，编辑器内改动由用户确认。

## 决策

1. **入口**：编辑器工具栏新增 `AI` 按钮（SparklesIcon），点击打开编辑器内嵌 AI 面板（非浮动菜单，避免 Tiptap BubbleMenu 依赖）；面板捕获当前选区。
2. **面板内容**：操作下拉（9 个 P0 特性）+ 语气下拉（feature=tone 时）+ 自定义指令输入（feature=custom 时）+ 运行按钮；结果区并排展示 原文 / AI 建议，提供 [替换选中] [插入下方] [重试]。
3. **后端统一**：所有特性走 `POST /api/admin/ai/editor`（单一端点，feature 字段路由），不按操作拆端点。
4. **选区文本上限 8000 字符**（schema 层），不发送全文，仅发送选区 + 标题/语言上下文（§7/8）。
5. **错误语义**：后端返回结构化 code（AI_PROVIDER_NOT_CONFIGURED / AI_AUTH_FAILED / AI_RATE_LIMITED / AI_TIMEOUT / AI_PROVIDER_ERROR），面板内联展示。
6. **无 Tiptap Pro 依赖**：仅使用既有 Tiptap Core + 自有 API（§119）。

## 影响

- app/admin/framework/RichTextEditor.vue：新增 AI 状态/函数/模板段（面板 + 按钮），未改动既有工具栏行为
- server/modules/ai/*：新增模块（网关/prompts），不影响既有业务
- 需要 `ai.use` 权限；AI 未配置时面板显示明确错误而非隐藏按钮（引导配置）

## 备选方案（否决）

- Tiptap BubbleMenu 浮动菜单：需要额外扩展与选区保持处理，第一版面板式更稳
- 每个操作独立端点（/ai/improve 等）：扩散 API 面，统一 feature 路由更符合 §14
- AI 直接替换正文：违反「Preview → Accept → Apply」核心原则（§2）
