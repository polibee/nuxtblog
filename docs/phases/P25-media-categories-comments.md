# P25 媒体分类管理完善 + 评论区 Thread 现代化

## 1. 基本信息

~~~text
Phase ID: P25
Phase Name: 媒体分类管理闭环 + 评论 UI 现代化（docs/前端评论区优化.txt P0）
Owner: polibee
NuxtAdmin Base Commit: a48695f
Depends On: P03/P20（媒体）、P07（评论）
Target Version: v0.2.0-p25
Status: COMPLETE
设计依据：docs/前端评论区优化.txt（122 节，P0 清单）
~~~

## 2. 实现范围（摘要）

### 媒体分类管理闭环（用户需求）

- MediaPickerField：分类下拉 + **内联新建分类**（输入名称 → + → 自动选中）；picker 内上传自动归入所选分类（folderId 随 FormData）
- 媒体库侧边栏：文件夹 **重命名**（✎ → 内联输入 → PUT /api/admin/media/folders/:id）+ 既有创建/删除/计数联动（删除文件夹媒体归未分类、移动更新计数）
- 新端点：PUT /api/admin/media/folders/:id

### 评论区现代化（P0 清单，保留现有 Nitro 后端）

- **Thread 布局**：CommentItem 去 Card，根评论 + 回复视为一个 Thread，border-left 连接线，留白分层（§12-15/83）
- **Root Composer**：收起态（头像+占位一行）→ focus 展开；游客昵称/邮箱 focus 后显示（§6-8）；字数 0/3000（§99）；空内容禁用提交（§100）
- **Inline Reply Composer**：点击回复在评论下方展开（回复 {name} 上下文），不再跳页底（§32-33）
- **操作区**：仅 回复 + ···（复制评论链接）；点赞/举报无后端支持未展示（§27-29 语义）
- **头像**：40/32px，首字母 + 按 name 哈希的稳定柔和底色（§16-17）
- **缩进**：最多 3 层视觉（移动 20px/桌面 32px，§36-39）
- **回复折叠**：每 Thread 默认显示 3 条回复 + ↳ 查看另外 N 条（§40-41）
- **Permalink**：#comment-N 滚动定位 + ring/bg-muted 高亮 2s 淡出（§47-49）
- **排序/加载**：最新/最早 + 每 10 个 Thread 加载更早（§57/60）
- **Pending**：提交后按服务端 status 显示轻提示（§102/43）
- **主题**：全部 token 化（bg-background/muted/border），暗色模式自动适配（§89）
- 未实现（无后端数据/能力，文档 P1）：点赞、举报、编辑/删除、OS/Browser 信息、作者徽章、Tiptap 富文本（评论现为纯文本）

## 3. 验证结果

~~~text
npm run lint      → PASS（0 errors；既有 v-html 警告 1 条可接受）
npm run typecheck → PASS
npm test          → PASS（167 tests / 21 files）
npm run build     → PASS
真实环境 E2E      → PASS
~~~

## 4. E2E 验证

- 文章页 SSR：id="comments" 区块、composer 按评论开关状态渲染
- 游客提交评论 → {id, status:'pending'} → 前端轻提示（不发 approved 乐观插入，§102）
- folders PUT rename / picker 创建+选择+上传归类走同一条 admin API

## 5. 完成记录

~~~text
Phase Status: COMPLETE
Acceptance: PASS（四道闸门 + 结构化验证；移动端/暗色走查留待用户）
Known Issues: 评论为纯文本（Tiptap stripped editor 需 content_json 迁移，属 P1）；点赞/举报/编辑删除无后端
Follow-up: Tiptap 评论编辑器（content_json+content_text）、点赞 optimistic、Comment Info Dialog、回复目标高亮
~~~
