# P28 AI 集成 v1（A1 网关 + A2 编辑器 AI）

## 1. 基本信息

~~~text
Phase ID: P28
Phase Name: AI Integration Layer v1（A1 AI Gateway + A2 Editor AI）
Owner: polibee
NuxtAdmin Base Commit: a48695f
Depends On: P10（加密服务）、P15.3（编辑器三模式）
Target Version: v0.2.0-p28
Status: COMPLETE
设计依据：docs/ai集成.txt（133 节，A1+A2 阶段 + Provider Layer）
~~~

## 2. 实现范围（摘要）

- **数据层（0029）**：ai_providers（API Key AES-256-GCM 加密存储 + masked hint + default_model）+ ai_requests（feature/model/status/tokens/latency/error_code/user 用量日志，不存 prompt/响应全文，§38/111）
- **AI Gateway**（server/modules/ai/）：generateCompletion 按 providerType 适配——openai/openai_compatible 走 /chat/completions，anthropic 走 /v1/messages（system 分离 + max_tokens）；错误映射 AI_AUTH_FAILED/AI_RATE_LIMITED/AI_TIMEOUT/AI_PROVIDER_ERROR
- **Prompt Registry**（§75/76）：prompts.ts——9 个编辑器特性（improve/rewrite/shorten/expand/grammar/clarify/summarize/tone/translate + custom），tone 内部映射 6 种语气；system 固定"仅输出结果文本"
- **统一端点**（§14/115）：POST /api/admin/ai/editor（feature 路由，ai.use 权限，usage 落库）；settings GET/POST（密钥空值保留旧值）、settings/test（10-token 探活，§35）、requests（最近用量）
- **AI 设置页**（§118/122）：/admin/ai——provider 表单（类型切换自动填 baseUrl/密钥留空保留/掩码显示）+ 测试连接 + 历史表 + 最近用量
- **Editor AI**（ADR 0005，§5-14）：RichTextEditor 工具栏 AI 按钮 → 内嵌面板：9 特性 + tone 语气 + custom 指令 → 运行 → **原文/AI 建议并排预览** → [替换选中] [插入下方] [重试]；选区上限 8000 字符，不发送全文（§7）；错误内联展示（含后端 code）
- 核心原则（§2）：AI 永不直接改数据——写回必须经用户 Replace/Insert 动作

## 3. 验证结果

~~~text
npm run lint      → PASS（0 errors；既有 v-html 警告 1 条可接受）
npm run typecheck → PASS
npm test          → PASS（167 tests / 21 files）
npm run build     → PASS
真实环境 E2E      → PASS（mock OpenAI 端点正向全链路）
~~~

## 4. E2E 验证

- mock OpenAI 兼容服务（127.0.0.1:3999/v1/chat/completions）→ settings POST 保存 provider（密钥加密落库，hint sk-m••••56）→ settings/test → { ok, latencyMs } → POST /api/admin/ai/editor（improve + 选区文本）→ 返回 AI 文本 + model + tokens → /api/admin/ai/requests 记录 editor.improve/ok/mock-model
- 反向验证：无 provider 时 editor 返回 503 AI_PROVIDER_NOT_CONFIGURED
- mock 服务与临时文件已清理；真实 provider 待用户填入 API Key（管理页测试连接验证）

## 5. 完成记录

~~~text
Phase Status: COMPLETE（A1+A2；A3-A8 按文档排期后续）
Acceptance: PASS（四道闸门 + mock 端到端；真实模型调用待用户配置 Key 后自测）
Known Issues: 无 streaming（P1）；usage 无成本字段（P1）；Page AI/Site AI 未开始（A3-A8）
Follow-up: Page AI（A3 规则引擎+建议面板）、Site AI（A5 Tool Registry + A6 Assistant）、AI 按键加密密钥独立于 COMMERCE_ENCRYPTION_KEY
~~~
