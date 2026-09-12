# ADR-0003: multirelation 字段类型（多选关联）

日期：2026-09-09
状态：Accepted
影响范围：app/admin/core/types.ts、app/admin/framework/FormField.vue、app/admin/schemas/builders/fields.ts、app/admin/forms/schemaToZod.ts

## 背景

Posts 与分类/标签是多对多关系（post_categories/post_tags）。基座表单引擎只有单选 `relation`，无法表达多选关联；Blog 框架需要声明式的多选字段来管理文章的分类与标签。

## 决策

1. 新增字段类型 `multirelation`：
   - `FieldNode.relation` 复用现有 `{ resource, labelKey }` 配置；值为 `Array<string | number>`（关联实体 id）。
   - `FormField.vue` 渲染为复选列表，选项从目标资源 API 懒加载（与 relation 相同路径），勾选即增删数组项。
   - `fields.ts` 新增 `multiRelationInput(name, label, relation, opts)` 构建器。
   - `schemaToZod` 映射为 `z.array(z.union([z.string(), z.number()]))`。
2. 不做搜索/分页（选项上限 perPage=200），与 relation 现状一致。

## 后果

- 多对多编辑完全声明式，Service 层负责 replace-all 关系表（post_categories/post_tags）。
- 实体数超 200 的站点需要升级为搜索式选择器（P19 加固清单备注）。
