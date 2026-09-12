# ADR 0004: Media Picker Field, Editor Modes and Framework Extensions

日期：2026-09-10
状态：ACCEPTED
关联：ADR 0001（LocalizedField）、0002（defaultValue）、0003（multirelation）

## 背景

文章/商品编辑存在三个框架层缺口：特色图片只能通过 relationInput 文本式下拉选择媒体 id；richtext 只有富文本单一模式；媒体库缺少分类维度。这些能力需要修改 `app/admin/core|framework`（约束：必须附 ADR）。

## 决策

1. **mediaPicker 字段类型**（`kind: 'mediaPicker'`，值 = media id 或 null）
   - `MediaPickerField.vue`（framework 自动注册目录）：弹窗网格展示媒体库（分页加载 40/页），支持按分类过滤，点击即选中
   - builder：`mediaPicker(name, label, opts?)`
   - PostResource 的 `featuredMediaId` 从 relationInput 迁移到 mediaPicker；存量值（数字 id）直接兼容
2. **richtext 三模式**（Markdown / 富文本 / 预览）
   - 编辑器内部 tab 切换；Markdown ↔ HTML 用 turndown + marked 双向转换
   - 预览模式渲染 sanitize 后的 HTML，不出编辑器
3. **媒体分类**：`media_folders` 表 + `media.folder_id`（可空、无外键——删除分类仅置空，不级联不阻塞）；`mediaPicker` 与媒体列表均支持 folderId 过滤
4. **表单容器加宽**：ResourceFormPage 容器 `max-w-3xl` → `max-w-5xl`，正文编辑获得更大书写宽度

## 影响

- FieldNode.kind 联合类型新增 `'mediaPicker'`（core/types.ts）
- 新增依赖：`marked`、`turndown`（仅编辑器使用）
- 不改变既有字段行为；relationInput 仍适用于一般外键下拉

## 备选方案（否决）

- 在 relationInput 里塞弹窗：混淆通用关系下拉与媒体特有网格/上传流
- Markdown 单向存储：与既有 HTML 正文数据（RSS/全文检索/短代码解析）不兼容

## 增补（2026-09-11，P20 媒体资产中心）

MediaPickerField 新增两个**可选**展示属性，不破坏既有调用：

- `usage?: string`（机器值，media.txt §4）——选择器列表按 usage_type 过滤，弹窗内上传自动携带 usageType 归类
- `recommended?: string`——触发器下方展示推荐规格提示（如 "1600×700 · 16:7"）

不改变默认行为：不传 usage 时列表/上传与原版完全一致。消费者：SliderManagerPage（slider 16:7 / 4:3 提示）。
