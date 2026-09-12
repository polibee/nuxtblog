# P36 AI + Languages Settings（设置.txt S5）

## 1. 基本信息

~~~text
Phase ID: P36
Phase Name: AI & Localization Settings（含 Model Router 接线）
Owner: polibee
NuxtAdmin Base Commit: a48695f
Depends On: P31（model-router）、P34（Foundation）
Target Version: v0.2.0-p36
Status: COMPLETE
设计依据：docs/设置.txt §31-34/77（S5 阶段）
~~~

## 2. 实现范围（摘要）

- **AI 页**（§31/32）：常规（启用 AI 功能）+ 模型档位（Writing/Analysis/Vision/Translation 四个用途化模型，留空 = Provider 默认——不暴露原始 provider:model 串，§32）+ 功能开关（Editor AI/AI Assistant）+ 默认分析深度（quick/balanced/deep）；Data Access 清单以只读边界描述表达（工具本就只读，§31）；Advanced（temperature 等，§33）按文档默认折叠后置
- **Languages 页**（§34）：默认语言 select（optionsLoader: 'locales' 动态选项——语言列表实体仍由语言注册表管理，Settings 只选默认）；保存时同步 locales 表 isDefault（注册表实体拥有列表，本设置选默认，无双源冲突）
- **Model Router 接线**（缓存优化 §19/20 + 设置 §31 闭环）：resolveModel 改为异步读 settings（ai.model.writing→fast、ai.model.analysis→standard/deep、ai.model.vision→vision），空值回落 provider.defaultModel；chat（chat.*）与 editor（editor.*）调用点接入——generateCompletion options.model + ai_requests.model 记录实际路由结果
- settings.service（getSettingValue）与 ai 模块单向依赖，无循环

## 3. 验证结果

~~~text
npm run lint      → PASS
npm run typecheck → PASS
npm test          → PASS（167 tests / 21 files）
npm run build     → PASS
真实环境 E2E     → PASS
~~~

## 4. E2E 验证

- languages 页 options 动态返回 ['zh-CN','en']（来自 locales 表）✓
- PATCH localization.default_locale=zh-CN → saved ✓
- PATCH ai.model.analysis=mock-analysis-model → chat 轮次 → ai_requests 最新记录 model=mock-analysis-model（mock 回显请求 model，证明网关发出的是路由后模型）✓ → Reset 后回落 Provider 默认 ✓

## 5. 完成记录

~~~text
Phase Status: COMPLETE（S5）
Acceptance: PASS
Known Issues: Vision 模型档位已可配置但 Vision 功能本体在 A4；AI Advanced 参数（§33）后置
Follow-up: S6 System（Email/Storage/Security/Backup 设置页接入既有面板数据）→ S7 Advanced（Raw Settings 只读门控 + Audit Log §60）
~~~
