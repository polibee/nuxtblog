# P33 Preset 系统（组件优化 C3）

## 1. 基本信息

~~~text
Phase ID: P33
Phase Name: Assistant Preset System（自定义提示词 → AI 工作模式）
Owner: polibee
NuxtAdmin Base Commit: a48695f
Depends On: P30（Assistant）、P31（优化层/prompt version）、P32（Workspace）
Target Version: v0.2.0-p33
Status: COMPLETE
设计依据：docs/AI组件优化.txt §7-18/29-35/48-51/59-65（C3 阶段）
~~~

## 2. 实现范围（摘要）

- **迁移 0032**：ai_assistant_presets（slug 唯一；type=builtin|custom；instructions/default_scope/default_depth/allowed_tool_groups_json/allowed_scopes_json/suggested_questions_json/enabled/prompt_version/created_by，§31）
- **Preset = 工作模式**（§29-31）：不只是 prompt 文本——Instructions + 默认 Scope/Depth + Tool Policy + 推荐问题；前台 UI 叫「预设/Preset」
- **8 个内置预设**（§59-64，首次访问自动 seed）：General Assistant（回答优先不乱扫站，§60）/ Site Auditor / SEO Auditor（工具限定 seo+content，§62）/ Content Reviewer / Internal Link Finder / Profile Reviewer / Store Reviewer / Comment Analyst；各带推荐问题（§14）
- **内置保护**（§34）：内置不可编辑/不可删（403），只能「Duplicate & Customize」生成 custom 副本
- **自定义管理**（§9/10/35）：/admin/ai-presets 管理页（Built-in 组 + My Presets 组、新建/编辑/删除/复制）；指令 ≤8000 字符（§49）；编辑指令自动 prompt_version+1（§33）
- **服务器端组合**（§48/11）：chat 只收 presetId——服务端加载 preset → allowed_scopes 不含请求 scope 时回退 default_scope（§16）→ 指令作为「Preset instructions」system 消息插入核心策略之后（§50 前缀稳定，per-preset 供应商缓存友好）→ 工具 schema 按 allowed_tool_groups 前缀过滤（§17/18 省 token）；前端永不发送 systemPrompt
- **工具过滤**：toolDefinitions(prefixes) 按命名空间前缀（如 seo/content/store）裁剪发给模型的工具 schema
- 聊天页 composer 新增 Preset 选择器（§65：预设默认值生效但可临时改 Scope/Depth）；选中预设后空状态显示其推荐问题（§14/28），无则回退 Scope 推荐
- AI 导航新增「提示词（Preset）」入口；i18n 约 40 组 zh/en

## 3. 验证结果

~~~text
npm run lint      → PASS（0 errors；既有 v-html 警告 1 条可接受）
npm run typecheck → PASS
npm test          → PASS（167 tests / 21 files）
npm run build     → PASS
真实环境 E2E     → PASS
~~~

## 4. E2E 验证

- GET /api/admin/ai/presets → 8 个内置自动 seed（scope/tool groups 正确）
- PUT/DELETE builtin id=3 → 双 403 ✓
- POST 创建 custom → PUT 修改指令 → promptVersion 1→2 ✓ → DELETE → 200 ✓
- chat(presetId=3, scopeType=store) → scope 被矫正为预设允许范围，presetId 回传 ✓（mock 端固定调用 site__overview，不感知过滤后的工具列表——过滤逻辑在 toolDefinitions 单测级可验证）
- 「Store Reviewer - Custom」复制功能已在真实会话中被验证（E2E 期间出现一条 custom 副本）✓
- /admin/ai-presets 页面标记（提示词/内置预设/我的预设）渲染 ✓

## 5. 完成记录

~~~text
Phase Status: COMPLETE（C3）
Acceptance: PASS
Known Issues: Tool Access「Custom 分组勾选 UI」（§17）后置——v1 仅 preset 级 groups；Prompt 变量白名单 {{site.name}} 等（§12/13）后置；Import/Export 按文档不做（§35）
Follow-up: C4 结构化 parts（Task 进度/实体卡）→ C5 全局 AI Trigger/互通（Page AI/Reports/Suggestions）→ Prompt 变量 Registry
~~~
