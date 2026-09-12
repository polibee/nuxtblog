# P32 Assistant Workspace UI（组件优化 C1+C2）

## 1. 基本信息

~~~text
Phase ID: P32
Phase Name: AI Assistant Workspace（C1 UI Foundation + C2 Workspace）
Owner: polibee
NuxtAdmin Base Commit: a48695f
Depends On: P30（Assistant）、P31（优化层）
Target Version: v0.2.0-p32
Status: COMPLETE
设计依据：docs/AI组件优化.txt §1-6/19-28/36-38/52/54/58/66（C1+C2 阶段）
~~~

## 2. 实现范围（摘要）

- **C1 基础组件**（app/modules/ai/admin/assistant/，§58 映射自实现——外部 AI Elements Vue 依赖被环境策略拦截，按其设计语言用现有 shadcn token 实现，不改视觉语言）：AIToolActivity（工具调用友好名称 + ✓/缓存命中/失败状态 + 开发者折叠详情，§24/25）、AISources（可折叠来源徽章，内部链接进 admin，§22/23）、AIConversationSidebar（Today/Yesterday/Previous 分组 + 删除，§52）、AIContextPicker（搜索并附加 Post/Page/Product 实体 Chip，§38；附件与上下文分离 §39）、AIContextInspector（右栏：Scope/Depth/Tools 自动只读/附加内容/~上下文规模，过大提示自动摘要，§36/37）
- **C2 Workspace**：AiChatPage 重写为三栏布局（小屏收起侧栏与右栏，§54）；空状态按 Scope 显示推荐问题（§27）；composer 保留 Scope + 新增 Depth（quick/balanced/deep）+ 附加上下文 Chips，输入区保持干净（§5/6）
- **后端配套**：chat 响应新增 toolActivity（工具+状态+耗时）与 contextTokens（§37 约估）；depth 真实控制 maxTokens 与工具轮数（§21：quick=1500/2 轮、balanced=3000/4、deep=4000/6，feature 记为 chat.<depth>）；context 注入=附加实体摘要（post 用 digest，page/product 摘要片段，≤6 个，token 上限截断，§12 金字塔）；DELETE /api/admin/ai/chat/conversations/:id（连消息+审计删除）；GET .../context-search（posts/pages/products 标题 LIKE 窄投影，§38）
- Scope 扩至 8 个（site/posts/pages/seo/profile/store/comments/media，§6）；对话标题仍为首条消息截断（§51）
- i18n：约 50 组 zh/en 新键（工具友好名 ×12、推荐问题 ×20、inspector/分组/来源等）

## 3. 验证结果

~~~text
npm run typecheck → PASS（lint/test/build 在 #133 收尾统一跑）
真实环境 E2E     → PASS
~~~

## 4. E2E 验证

- context-search?q=Nuxt → 命中 post#2（zh/en 两行）
- chat turn（depth=quick + context=[post#2]）→ depth/quick 生效、contextTokens=175 回传、toolActivity=[site.overview ok]、回复来自真实数据
- DELETE conversations/9 → 200 且列表不再包含
- /admin/ai-assistant 页面标记：AI 助手/上下文（Inspector）/整站（Scope）/推荐问题（空状态）全部渲染 ✓

## 5. 完成记录

~~~text
Phase Status: COMPLETE（C1+C2）
Acceptance: PASS
Known Issues: 非 streaming（AI Elements Conversation 的流式渲染依赖其上游库，C1 后置）；Message 分支/多答案（§21）后置；移动端左栏 Drawer/右栏 Sheet 用隐藏替代（§54 P1）
Follow-up: C3 Preset 系统（#132）→ C4 结构化 parts → C5 全局 AI Trigger / Page AI·Reports 互通
~~~
