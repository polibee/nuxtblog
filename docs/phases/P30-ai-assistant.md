# P30 AI Assistant（Tool Calling 站点分析聊天）

## 1. 基本信息

~~~text
Phase ID: P30
Phase Name: AI Assistant / Site Chat（A5 Tool Registry + A6 Assistant v1）
Owner: polibee
NuxtAdmin Base Commit: a48695f
Depends On: P28（AI Gateway + Provider）、P29（profile 表共享迁移）
Target Version: v0.2.0-p30
Status: COMPLETE
设计依据：docs/ai优化.txt §15-34（Progressive Context、Tool Registry、Scope、References、只读原则）
~~~

## 2. 实现范围（摘要）

- **AI Tool Registry**（server/modules/ai/tools.ts，§32/34）：READ-only 工具 11 个，命名空间式命名（site.overview / content.posts.list / content.posts.get（正文截断 4000 字符）/ content.search（SQL LIKE）/ pages.list / seo.summary / profile.get / taxonomy.list / comments.summary（仅 approved，脱敏）/ store.summary / media.summary）；每个工具仅 select 窄投影列——不返回全文行、不返回密钥/私人数据（§87-90）；toolDefinitions() 将名称 `.`→`__` 映射为 OpenAI function 名，resolveTool() 反向解析
- **Chat Service**（server/modules/ai/chat.service.ts）：会话持久化（getOrCreateConversation/getConversations/getConversationMessages/saveMessage）+ saveToolCall（ai_tool_calls 审计：tool/status/duration_ms，不存原始结果，§31）；runAssistantTurn——**原生 OpenAI function-calling 循环**：gateway 携带 tools 数组 → 响应解析 message.tool_calls → 逐个执行真实工具 → 以 role:tool + tool_call_id 回填 → 迭代至无 tool_calls；MAX_TOOL_ITERATIONS=6，超限后追加「基于以上工具结果给出最终回答」强制文本；references 从 posts.list/search 结果提取（type+id 去重）；system prompt 固定只读约束 + 用户语言回答 + 不编造数据
- **Gateway 扩展**（ai.service.ts）：generateCompletion options 增加 tools；openai 分支响应类型捕获 tool_calls（arguments 安全 JSON 解析，容错返回 {}）；AiCompletionResult 增加 toolCalls；anthropic 分支 toolCalls=[]（v1 仅文本，不支持 anthropic 工具）
- **Admin API**（均 requirePermission('ai.use')）：POST /api/admin/ai/chat（消息 ≤4000 字符、无 provider 返回 503 AI_PROVIDER_NOT_CONFIGURED）、GET .../chat/conversations（按登录用户，近 50）、GET .../chat/messages?conversationId=
- **聊天页**（app/modules/ai/，资源 ai-assistant → AI 组）：左侧会话历史 + 新对话；右侧 Scope 选择器（整站/文章/SEO/个人主页/商店/评论——仅提示优先范围，§23）+ 气泡对话区 + assistant 消息下方的 references 来源徽章（直链 /admin/posts/{id}/edit，§25 可检查结论）+ composer（Enter 发送）；503 错误内联提示引导到 AI 设置
- **数据表**（0030 共享迁移）：ai_conversations（user_id/title/scope_type）+ ai_messages（role/content/references_json，不存 tool 原始结果）+ ai_tool_calls（tool/status/duration_ms）
- 核心原则（§26/27）：聊天只读——不提供任何 ACTION 工具；写操作必须走人工流程（后续 suggestion apply）

## 3. 验证结果

~~~text
npm run lint      → PASS（0 errors；既有 v-html 警告 1 条可接受）
npm run typecheck → PASS
npm test          → PASS（167 tests / 21 files）
npm run build     → PASS
~~~

## 4. E2E 验证

- mock OpenAI 兼容服务（tests/e2e/mock-openai.cjs，:3999）：第一轮返回 site__overview function call → 网关解析原生 tool_calls → 执行 site.overview（真实 postCount=1）→ 第二轮 mock 读取 tool 结果输出「站点当前共有 1 篇已发布文章。」——**回复数字来自真实数据库而非编造** ✓
- 「列出文章」轮次：content__posts.list → 引用 2 条翻译行 → references type+id 去重后 1 条 {type:post,id:2,title:Nuxt 4 博客框架起步} ✓
- 会话持久化：conversations 列表（title 取首条消息、scope_type）+ messages 回读（含 references_json）✓；ai_tool_calls 审计行随每次工具执行落库 ✓
- 无效工具名走 unknown-tool 兜底（role:tool 返回 error JSON），不会中断对话循环 ✓
- 后台导航：/admin 出现「AI 助手」（AI 组）✓

## 5. 完成记录

~~~text
Phase Status: COMPLETE（A5+A6 v1）
Acceptance: PASS（四道闸门 + mock 端到端工具调用全链路）
Known Issues: 非 streaming（SSE P1）；scope 仅作为 system 提示不裁剪工具集；anthropic 不支持工具（纯文本问答）；会话摘要压缩未做（§24，长对话后置）
Follow-up: A3 Page AI（结构化审计）→ A7 报告 → A4 Vision → A8 Analytics/GSC；工具逐步扩展 getInternalLinks/getOrphanContent 等深度 SEO 工具（§18）
~~~
