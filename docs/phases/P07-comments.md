# P07 Comments

## 1. 基本信息

~~~text
Phase ID: P07
Phase Name: Comments
Owner: polibee
NuxtAdmin Base Commit: a48695f
Depends On: P04
Target Version: v0.2.0-p07
Status: COMPLETE
~~~

## 2. 实现范围

- comments 表：post FK CASCADE、parent_id 自引用嵌套回复（CASCADE）、user FK SET NULL、author_name/email、content text、status(pending|approved|spam)、时间戳；索引(post+status / parent / user)。
- 公开提交 POST /api/public/posts/[alias]/comments：alias 路由解析 → 评论开放检查 → 限流 5 次/10min/IP → Zod 校验（name/email/content）→ 纯文本存储（sanitize 剥离全部标签）→ 落入 pending（审核门控）。
- 公开列表 GET /api/public/posts/[alias]/comments：仅 approved，树形（parentId 嵌套）。
- 后台审核：/api/admin/comments 静态目录接管（列表含文章 alias/状态过滤、PUT 状态变更、DELETE）；CommentsResource 表格+通过/垃圾 Action。
- PostResource/文章编辑页 comment_status open/closed 控制；文章详情页评论开放时渲染 PostComments（列表+表单+回复），提交后重新加载列表。
- posts.comment_status 字段（P04 已建列）在 P07 激活使用。

### 非目标

- 不做邮件通知（评论被通过时通知作者）、Akisma/反垃圾集成（P19）、投票/点赞。

## 3. 数据模型

~~~text
comments: id, post_id FK posts CASCADE, parent_id FK self CASCADE, user_id FK users SET NULL,
          author_name varchar(80), author_email varchar(255), content text,
          status(pending|approved|spam), created_at, updated_at
索引: (post_id, status), (parent_id), (user_id)
~~~

## 4. 验证结果

~~~text
提交 → pending 200；公开列表 pending 不可见
后台 approve → approved；公开列表可见
后台 spam → spam；公开列表隐藏
delete → 200
未登录提交 → 需 name/email（422 缺失时限流除外）
限流 → 第 6 次 429
四闸门：lint/typecheck/test(124)/build 全过
~~~

## 5. 完成记录

~~~text
Phase Status: COMPLETE
Acceptance: PASS
Known Issues: 无邮件通知；无嵌套层数限制（数据层面支持但 UI 只渲染两层）
Follow-up: P19 反垃圾/邮件通知；P20 多语言评论文案
~~~
