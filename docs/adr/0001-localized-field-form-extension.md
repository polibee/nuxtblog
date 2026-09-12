# ADR-0001: LocalizedField 表单扩展（新增 localized 字段类型）

日期：2026-09-09
状态：Accepted
影响范围：app/admin/core/types.ts、app/admin/framework/FormField.vue、app/admin/schemas/builders/fields.ts、app/admin/extensions/localized-field/

## 背景

博客框架的内容模型为 Entity + Translation（posts + post_translations 等，见 docs/Blog-Framework-v1.0-nuxtadmin-architecture.md §8.3）。管理后台需要一个通用多语言字段编辑器，输入结构固定为 `translations[locale][field]`，由领域 Service 在事务内拆分写入两张表。这不能把 Translation 当作普通 JSON 字段随意建模。

## 决策

1. 新增字段类型 `localized`：
   - `app/admin/core/types.ts`：`FieldType` 增加 `'localized'`；`FieldNode` 增加 `localizedFields?: FieldNode[]`（每个 Locale 下渲染的子字段，如 title/slug/content）。
   - `app/admin/framework/FormField.vue`：新增 `kind === 'localized'` 分支，委托给扩展组件渲染。
   - `app/admin/schemas/builders/fields.ts`：新增 `localizedInput(name, label, opts)` 构建器。
2. 扩展组件位于 `app/admin/extensions/localized-field/`（不属于 core/framework/ui）：
   - `LocalizedField.vue`：LocaleTabs + 按 Locale 渲染子字段；值结构 `{ [localeCode]: { [field]: value } }`；未填写完整度的 Locale 显示 MissingTranslationBadge。
   - `TranslationStatus.vue` / `MissingTranslationBadge.vue`：完整度徽标（Missing / Incomplete / Complete）。
   - Locale 列表来自 `GET /api/public/locales`（仅 enabled），加载失败降级为默认 Locale 单 Tab。
3. 不把该组件硬编码进 ResourceFormPage；仍由声明式 FormSchema 驱动，与其他字段一致。

## 后果

- 修改了 core 与 framework 各一处（新增类型分支），均为增量、不影响既有字段类型。
- Zod 校验：`localized` 值为 `Record<string, Record<string, unknown>>`，字段级规则由 `localizedFields[].rules` 在 schemaToZod 中按 locale 展开（P04 接入时补齐映射）。
- 不上游到 NuxtAdmin 基座前，Posts/Pages 编辑页使用该扩展（符合架构文档 §5.3 的降级方案）。
