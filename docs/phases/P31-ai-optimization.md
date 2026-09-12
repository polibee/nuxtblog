# P31 AI 优化层 v1（缓存/指纹/工件/工具缓存/快照/摘要/预算/模型路由/指标）

## 1. 基本信息

~~~text
Phase ID: P31
Phase Name: AI Optimization Layer v1（AI 缓存优化）
Owner: polibee
NuxtAdmin Base Commit: a48695f
Depends On: P28（AI Gateway）、P30（Assistant + Tool Registry）
Target Version: v0.2.0-p31
Status: COMPLETE
设计依据：docs/AI缓存优化.txt（§56 P1 首版清单；Semantic/Vector/Redis 后置）
~~~

## 2. 实现范围（摘要）

- **迁移 0031**：ai_artifacts（entity_type/entity_id/artifact_type/source_fingerprint/model/prompt_version 唯一键 + payload_json + tokens，§36）、ai_tool_cache（cache_key 唯一 + payload_chars + expires_at，§37）、ai_domain_versions（domain 唯一 + version，§10）；ai_requests += cache_status/cached_input_tokens/saved_tokens（§45）；ai_conversations += summary_text/summary_until_message_id（§24/25）
- **Fingerprint Service**（optimization/fingerprint.ts）：post/page/profile/product 内容指纹 + post/page 的 seo 域指纹（§3/4，与 updated_at 解耦）；editor 选择指纹
- **Domain Version Counters**（domain-versions.ts + invalidate.ts）：bumpAiDomains 在 posts/pages/taxonomy/products/comments/profile/media 写入路径递增；§32 最小失效面（评论写入不碰 posts/seo）；5s 内存版本表缓存
- **AI Artifact Store**（artifact-cache.ts）：getArtifact/saveArtifact/withArtifact（get-or-compute + single-flight，§35/48），prompt_version 进 key（§38）
- **Tool Result Cache**（tool-cache.ts）：key=sha256(tool+规范化 args+域版本签名)（§8）；TOOL_DOMAINS 映射最小域集；10min TTL 作漏事件安全网（§9）；withToolCache + single-flight
- **Site Snapshot**（site-snapshot.ts，§11）：站点概览 artifact（posts published/draft/missingSeo、pages、products、comments、profile、media、locales）按版本指纹缓存，site.overview 工具改为读快照
- **Entity Digest**（digest.ts，§13/14）：0-token 便宜摘要（title/excerpt 摘要/关键词=tag 名/词数/## 标题），artifact 键在内容指纹上；新增 content.posts.digest 只读工具
- **Token Budget**（token-budget.ts，§22/23）：CJK 感知 token 估算 + 按优先级 P3→P0 丢弃 + 最后比例截断；FEATURE_BUDGETS 分级
- **Model Router**（model-router.ts，§19/20）：feature→ModelClass（fast/standard/deep/vision）记录进指标与 artifact key；v1 单模型解析（provider.defaultModel），per-class 覆盖留到 provider 设置
- **会话压缩**（chat.service conversationContext，§24/25）：>10 条时旧消息折叠为确定性摘要（0 token），summaryUntilMessageId 保证字节稳定（供应商前缀缓存友好）
- **Prompt 前缀稳定**（§15/16）：静态 SYSTEM_PROMPT 固定在最前，scope 注入首条用户消息；§51 标题=首条消息截断（不额外调模型）
- **用量指标**（§45/46）：chat 轮次落 ai_requests（cacheStatus=TOOL_HIT/MISS、savedTokens≈工具负载 chars/4）；AI 设置页最近用量展示命中与节省
- prompts.ts 增加 EDITOR/CHAT_PROMPT_VERSION（§38）

## 3. 验证结果

~~~text
npm run typecheck → PASS（lint/test/build 在 #133 收尾统一跑）
真实环境 E2E     → PASS（MISS → TOOL_HIT → 写入失效 MISS 全链路）
~~~

## 4. E2E 验证

- 第 1 轮 chat（site.overview）：ai_requests cache=MISS saved=0；回复文章数=真实 DB
- 第 2 轮相同工具（新会话）：cache=TOOL_HIT saved=62 —— 工具结果复用，模型无需重新拿全量工具负载
- 创建标签（bump taxonomy）后再问：cache=MISS —— **域版本事件失效生效**（评论/媒体等无关域不受影响，§32）
- ai_tool_calls 落 status='cache_hit'/'ok' 审计；快照/摘要在 ai_artifacts

## 5. 完成记录

~~~text
Phase Status: COMPLETE（§56 P1 清单除 Page Analysis Cache——A3 未建，由 Artifact Store 承接）
Acceptance: PASS
Known Issues: 无 semantic cache/vector（§26 后置）；saved_tokens 为启发式估算；域计数器漏钩子场景由 10min TTL 兜底
Follow-up: A3 Page AI 用 dimension+domain fingerprint 增量缓存（§5）；A7 报告增量分析（§29/30）；provider per-class 模型设置
~~~
