# P34 Settings Foundation + UI（设置.txt S1+S2）

## 1. 基本信息

~~~text
Phase ID: P34
Phase Name: Settings Foundation + UI Foundation
Owner: polibee
NuxtAdmin Base Commit: a48695f
Depends On: P02（settings 表）、ADR 0006
Target Version: v0.2.0-p34
Status: COMPLETE
设计依据：docs/设置.txt §1-15/42-52/63-69/81-82（S1+S2 阶段）
~~~

## 2. 实现范围（摘要）

- **Settings Registry**（server/modules/settings/registry.ts，§11/69）：SettingDefinition（dotted key（§52）+ legacyKey 适配旧消费端 + envKey 环境覆盖 + visibleWhen 条件字段 + 双语标签内联）+ SettingsPageDef（group/page/section/field 三层，§64）；模块可用 registerSettingsPage 自注册（§54，Core 不知道具体模块）
- **Settings Service v2**（ui.service.ts）：Environment > Database > Default 来源解析（§42/49）；secret 永不回明文，只回 configured/last4（§44）；服务端按 registry 再校验（§48：未知 key 422、min/max、select 白名单）；批量 PATCH（§46/47）；Reset=删 DB 覆盖（含 legacy 行），默认值自然透出（§59/67）；legacyKey 双写保证旧消费端（SITE_NAME 等）在迁移前继续工作
- **缓存失效**：保存/Reset 后 invalidateSettingsCache + 页面缓存 public-settings:{locale} 按 locale 精确失效（发现并规避 invalidatePageCache 精确键无法匹配 locale 后缀的坑）
- **API**：GET /api/admin/settings-ui（导航+搜索索引）、GET/PATCH :page、POST :page/reset；权限 settings.view / settings.edit（§61：编辑者无 settings 权限，碰不到 SMTP/Secret）
- **Workspace UI**（app/modules/settings/admin/SettingsWorkspacePage.vue + ui/FieldRenderer/SaveBar，§5/6/7/13/65）：左 240px 导航按组生成 + 内容区 Section+分隔线（不套大卡片）+ 顶部搜索（label/description/key 过滤 → 跳页 + scrollIntoView + 高亮，§15/16）+ Field Renderer 七类字段统一渲染（text/textarea/number/switch/select/media/secret，§12 子集）+ Dirty Save Bar（仅变更时出现，Discard/Save，§7）+ 未保存离开守卫（route guard + beforeunload）+ Environment 来源徽标与字段禁用（§43）+ 每字段恢复默认
- **深链**（§63，ADR 0006）：/admin/settings/general、/appearance、/content… 独立 URL——resource router 扩展 pages.view 覆盖（app/admin/core/types.ts + [..path].vue，附 ADR 0006）；旧键值面板降级为 pages.raw 预留位（/admin/settings/raw，S7 Raw Editor 接管）
- 首批页面：General（站点身份/管理/首页）、Appearance（主题/布局，不开放设计系统内部参数 §18）、Content（文章/相关内容）

## 3. 验证结果

~~~text
npm run lint      → PASS（0 errors；既有 v-html 警告 1 条可接受）
npm run typecheck → PASS
npm test          → PASS（167 tests / 21 files）
npm run build     → PASS
真实环境 E2E     → PASS
~~~

## 4. E2E 验证

- 来源解析：site.title 经 legacyKey 读到 SITE_NAME（database）；site.timezone 无覆盖 → default UTC；无默认无覆盖 → default/null
- 保存 site.timezone → source 翻转 database；值校验（posts_per_page=500 → 422；未知 key → 422）
- legacy 双写：改 site.title → 公开端 SITE_NAME 立即变化；Reset（双行删除 + 缓存失效）→ 前端回落默认名
- 页面缓存：public-settings:{locale} 键在保存/Reset 后立即失效（发现精确键不匹配 locale 后缀问题并修复为按已知 locale 枚举失效）

## 5. 完成记录

~~~text
Phase Status: COMPLETE（S1+S2+S3 前三页）
Acceptance: PASS
Known Issues: Audit Log（§60）未接（跟随 S7）；field 级 color/date/repeatable/code 类型后置
Follow-up: S3 其余页（P35）→ S5 AI/Languages（P36）→ S6 System → S7 Raw Editor/审计
~~~
