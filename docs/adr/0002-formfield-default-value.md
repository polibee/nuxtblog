# ADR-0002: FormField 支持 node.defaultValue 作为创建页初始值

日期：2026-09-09
状态：Accepted
影响范围：app/admin/framework/FormField.vue

## 背景

`FieldNode.defaultValue` 自基座首个版本就存在于类型定义并被多个 Resource 使用（users 的 role/status、sidebar-cards 的 enabled/sortOrder），但从未被任何渲染代码消费——创建表单里所有 defaultValue 实际无效（例如「启用」开关默认关闭，与声明相反）。编辑页通过 `ResourceFormPage` 的 `form.setValues(record)` 注入真实记录值，不存在此问题。

## 决策

在 `FormField.vue` 中把 `node.defaultValue` 作为 vee-validate `useField` 的 `initialValue` 传入：

- 创建页：表单值为空时字段初始值生效。
- 编辑页：`form.setValues(record)` 写入的路径值优先于字段级 initialValue（vee-validate 语义），行为不变。
- 不改动 `useFormSchema` 与 `ResourceFormPage`。

## 后果

- 所有已声明 defaultValue 的资源字段（含演示资源）开始按声明生效，属于 bug 修复而非行为破坏。
- 不支持以函数/响应式形式提供 defaultValue；需要动态默认值的场景继续由 action form 或 Service 层默认值承担。
