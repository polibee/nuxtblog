# 认证、公开身份与多语言评论体验设计

日期：2026-09-12  
状态：设计稿，待实现计划确认  
适用分支：当前 MySQL + Drizzle 开发环境

## 1. 背景与目标

当前项目已经具备 MySQL 持久化认证、Session、会员计划、公开个人主页、文章详情页和基础评论审核能力，但仍缺少完整的公开身份体系：

- 没有公开注册和用户个人中心；
- 用户角色、VIP/付费状态与评论作者展示没有统一 View Model；
- 游客评论没有网址、Gravatar、浏览器/操作系统和验证码能力；
- 管理员不能直接回复评论；
- 文章页作者区域仍是简单字母占位，未复用侧栏作者卡片；
- 个人主页和文章详情页的中英文布局、链接和 SEO 语言上下文不完全一致。

目标是建立一套可公开展示、可维护、可扩展的身份与内容阅读体验，同时保留现有 MySQL + Drizzle 运行方式，不引入第二套认证来源。

## 2. 范围与非目标

### 2.1 本期范围

1. 注册、登录、密码、安全设置和用户个人中心；
2. VIP/付费用户/管理员勋章；
3. 登录用户与游客评论；
4. Gravatar、游客网址、浏览器/操作系统标准化信息；
5. Cloudflare Turnstile 游客验证；
6. 管理员回复评论和评论树；
7. 公开个人主页现代化设计；
8. 文章详情页阅读体验和作者卡片；
9. 统一多语言内容、链接、SEO 和缺少翻译状态。

### 2.2 非目标

- 本期不切换 Supabase Auth，也不新增 OAuth/JWT 身份来源；
- 不把会员权限、管理员权限写成可由客户端修改的字段；
- 不保存原始 IP 或完整 User-Agent；
- 不实现自动扣款、复杂社交关系或收藏系统；
- 不把多语言内容改成 `title_zh/title_en` 形式；
- 不在公开接口返回邮箱、密码哈希、内部权限数组或敏感设置。

## 3. 方案选择

采用“现有认证 + MySQL Drizzle Repository + 领域服务”的方案。

```text
前端页面
  → Nitro API
  → Auth / Permission
  → Domain Service
  → Repository Contract
  → MySQL Drizzle Adapter
```

认证、会员、评论和个人资料全部通过 `users.id` 关联。后续恢复 PostgreSQL/Supabase 时，只替换 Repository adapter，不改变页面和领域服务契约。

## 4. 认证与权限设计

### 4.1 页面和 API

```text
/register
/login
/reset-password
/account

POST /api/auth/register
GET  /api/auth/me
POST /api/auth/login
POST /api/auth/logout
POST /api/auth/password-reset/request
POST /api/auth/password-reset/confirm
GET  /api/auth/profile
PUT  /api/auth/profile
POST /api/auth/change-password
GET  /api/auth/sessions
DELETE /api/auth/sessions/:id
```

### 4.2 注册规则

- 邮箱 trim 后统一小写并唯一校验；
- 昵称长度 1–80；
- 密码继续使用现有 scrypt 哈希；
- 注册用户默认为 `viewer` + `active`；
- 角色只能由具备用户管理权限的后台操作修改；
- 注册、登录、重置密码均限流；
- 邮箱验证通过配置开关控制，开发环境可以关闭，生产环境建议开启；
- 所有修改自己的接口按当前 Session 的 `user_id` 过滤。

### 4.3 权限层级

```text
游客       → 公开内容、允许时提交评论
登录用户   → 个人资料、自己的评论、自己的订单/会员
VIP 用户   → 登录用户能力 + 会员权益
管理员     → 用户、内容、评论、会员、订单、设置管理
```

服务端继续使用 `requireUser` 和 `requirePermission`，前端权限过滤只用于体验，不作为安全边界。

## 5. 用户个人中心

```text
/account
├── 概览：头像、昵称、身份、勋章、最近活动
├── 个人资料：昵称、头像、网址、简介、语言、时区
├── 我的评论：待审、已通过、垃圾评论
├── 我的会员：当前计划、到期时间、权益
├── 我的订单：订单状态、金额、交易入口
└── 安全设置：改密、当前会话、退出其他设备
```

个人中心只返回当前用户数据。管理员后台可以查看用户，但邮箱等敏感字段需脱敏；角色、状态、会员有效期和勋章授予不允许在用户中心修改。

## 6. 勋章和会员身份

不在 `users` 表增加不可扩展的 `is_vip`，新增通用勋章模型：

```text
badges
├── id
├── key
├── name
├── description
├── icon
├── color
├── sort_order
└── enabled

user_badges
├── id
├── user_id
├── badge_id
├── source_type
├── source_id
├── granted_at
└── expires_at
```

默认勋章：`member`、`vip`、`supporter`、`author`、`commenter`、`admin`、`founding_member`。

规则：

- VIP 勋章根据有效会员状态实时计算或由领域事件同步；
- 过期勋章不在公开接口返回；
- 评论区最多显示两个主要勋章，完整勋章在详情中展示；
- 勋章的公开名称、图标和颜色通过 `BadgeView` 返回；
- 用户不能自行创建或伪造勋章；
- 会员、订单和勋章使用同一 `user_id`，订单状态是权限事实来源。

## 7. 评论体验与数据设计

### 7.1 评论身份

登录用户自动使用账号昵称、邮箱、头像和勋章；游客必须填写名称、邮箱、评论内容，可选填写网址并完成 Turnstile。

游客网址只允许 `http/https`，输出时强制：

```html
rel="nofollow noopener noreferrer"
```

禁止 `javascript:`、`data:`、回环地址和私网地址。

### 7.2 Gravatar

服务端使用 `md5(trim(lower(email)))` 生成 Gravatar hash，只保存 hash，不向公开 API 返回邮箱。头像优先级：用户媒体头像 → Gravatar → 本地 identicon。

Gravatar 是否启用由设置控制；远程头像加载失败不影响评论布局。

### 7.3 浏览器和操作系统

服务端解析 User-Agent，仅保存：

```text
browser_name
browser_version
os_name
os_version
device_type
```

不保存原始 User-Agent。公开显示由设置控制，示例：`Chrome / Windows`。

### 7.4 评论表扩展

现有 `comments` 增加：

```text
author_url
gravatar_hash
browser_name
browser_version
os_name
os_version
device_type
ip_hash
moderation_reason
approved_at
approved_by
```

`ip_hash` 仅用于限流和反垃圾，使用站点级盐，不用于展示；评论内容继续服务端清洗并以纯文本或白名单 HTML 存储。

### 7.5 管理员回复

```text
POST /api/admin/comments/:id/reply
```

回复使用当前管理员的 `user_id`，通过 `parent_id` 建立评论树。回复进入待审核或直接通过由评论设置决定。前台渲染最多三层视觉缩进，超过层数继续保留数据但不让移动端横向溢出。

## 8. Cloudflare Turnstile

使用 Cloudflare Turnstile，而不是把 Cloudflare secret 当作前端验证码 API。

设置：

```text
comments.turnstile_enabled
comments.turnstile_site_key
comments.turnstile_secret_key
comments.show_browser
comments.show_os
comments.show_gravatar
comments.show_guest_website
comments.max_reply_depth
comments.require_approval
```

`site_key` 可以下发前端；`secret_key` 只能保存在服务端环境变量或加密设置中，后台只显示掩码和配置状态。服务端在写入评论前向 Turnstile 校验 token，失败返回 422/403，不产生评论记录。

## 9. 公开个人主页设计

### 9.1 信息架构

个人主页作为可分享的作品集入口，而不是后台表单的直接投影：

```text
首屏 Hero
  ├── 头像、姓名、身份描述、所在地
  ├── 简介
  ├── 社交渠道
  └── 查看文章 / 联系我

精选项目
工作经历 / 当前专注 / 技能
教育经历 / 证书 / 联系方式
```

桌面端使用左右分栏，移动端上下堆叠；空区块不渲染。项目卡片优先真实封面，没有封面时使用稳定的构图式占位封面，不使用单字母大色块。

### 9.2 多语言

个人资料、简介、项目名称/描述、经历和区块内容从 Profile Translation 读取；UI 文案从 UI i18n 读取。中文和英文使用相同布局契约，只替换语言内容，缺少翻译时明确显示未完成状态或按产品配置回退。

## 10. 文章详情页设计

### 10.1 布局

```text
文章头部：面包屑 / 语言 / 标题 / 摘要 / 作者 / 日期 / 阅读时间
正文主栏：封面 / 目录 / 正文 / 付费内容
上下文：作者卡片 / 标签 / 分类
底部：上一篇 / 下一篇 / 相关文章 / 评论区
```

桌面端采用阅读主栏 + 辅助栏，目录固定在辅助栏；移动端目录改为可展开区域。标题、摘要、封面和正文之间保持清晰的阅读节奏，降低元信息噪音。

### 10.2 作者卡片复用

现有 `AuthorCardView` 升级为统一组件，增加三种变体：

```ts
type AuthorCardVariant = 'sidebar' | 'article' | 'profileHero'
```

统一 View Model：

```text
ResolvedAuthorCard
├── name
├── headline
├── bio
├── avatar
├── socials
├── cta
└── profileUrl
```

- `sidebar`：紧凑头像、简介和最多五个图标；
- `article`：横向头像、作者介绍、社交渠道名称和查看主页按钮；
- `profileHero`：大头像、完整社交入口和首屏 CTA。

文章页底部使用 `article` 变体，不再单独渲染字母头像。社交渠道来自同一份后台作者卡片配置，并支持 GitHub、网站、邮箱等安全链接。

## 11. 多语言路径和 SEO 一致性

新增统一的 `localizedPath()` 和 `localizedPostPath()` 逻辑：

```text
当前：/posts/nuxt4-blog-start?locale=zh-CN
切换英文：先解析同一文章的英文 translation alias，再生成英文链接
```

规则：

- 语言切换不能只复用当前 URL 字符串；必须解析同一 Entity 的目标语言 alias；
- 缺少目标翻译时显示明确提示或进入可用的默认语言入口，不伪装成翻译完成；
- 面包屑、分类、标签、邻接文章、相关文章和作者 CTA 都带当前 locale；
- `lang`、canonical、hreflang、JSON-LD author URL 使用实际展示语言；
- 页面加载、缺少翻译、回退、404 和错误状态使用同一 UI i18n。

## 12. 目录和接口边界

计划新增或调整：

```text
app/pages/register.vue
app/pages/account.vue
app/components/public/AuthorCardView.vue
app/components/public/ProfileHero.vue
app/components/public/ProfileProjectCard.vue
app/components/public/ArticleHeader.vue
app/components/public/ArticleAuthorCard.vue
app/components/public/LocalizedBreadcrumbs.vue
shared/types/author.ts
shared/types/account.ts
server/repositories/badge.repository.ts
server/repositories/user-profile.repository.ts
server/modules/account/account.service.ts
server/modules/comments/comment.service.ts
```

API handler 只负责鉴权、参数解析和错误映射；服务层只依赖 Repository Contract；页面只消费公开 View Model，不读取数据库字段。

## 13. 安全、隐私和错误语义

- 注册、登录、重置密码、评论和 Turnstile 校验全部限流；
- 评论网址执行协议、主机和私网地址校验；
- 公开接口不返回邮箱、原始 IP、User-Agent、密码或内部权限；
- 认证失败 401，权限不足 403，输入错误 422，业务冲突 409；
- 会员和勋章由服务端计算，客户端只能展示；
- Turnstile 和 Gravatar 外部服务失败不能阻断已存在内容的读取；
- 评论通过、回复和勋章变化通过事件触发通知，通知失败不得回滚核心评论操作；
- 生产环境开启 HTTPS、secure cookie 和邮箱验证。

## 14. 分阶段实施

1. 认证与个人中心：注册、资料、安全设置、自己的评论/订单/会员入口；
2. 勋章领域：schema、Repository、会员状态映射、公开 Badge View；
3. 评论数据与游客能力：字段迁移、Gravatar、网址、UA 解析、Turnstile；
4. 管理员回复和评论树：回复 API、权限、审核状态、前台树形 UI；
5. 个人页和文章页：Hero、项目卡片、文章作者卡片、响应式布局；
6. 多语言一致性：目标语言 alias、统一链接、SEO、缺少翻译状态；
7. 集成验收：MySQL CRUD、权限、登录用户评论、游客评论、Turnstile 成功/失败、勋章和移动端 E2E。

## 15. 测试和验收标准

Unit：

- 邮箱归一化、密码规则、权限边界；
- Badge 过期和会员状态映射；
- Gravatar hash、UA 解析、URL 安全校验；
- 评论回复层级和状态转换；
- locale alias、localizedPath、缺少翻译状态。

Integration/E2E：

- 注册 → 登录 → `/api/auth/me` → 个人中心；
- 普通用户不能修改角色或查看其他用户数据；
- VIP/付费订单产生正确勋章，过期后不再展示；
- 登录用户评论、游客评论、游客网址 nofollow；
- Turnstile 成功写入、失败不写入；
- Gravatar 和本地头像回退；
- 管理员回复显示在正确父评论下；
- 中文/英文文章页和个人页布局一致、链接语言一致；
- 桌面端、移动端、无评论、评论关闭、缺少翻译和接口失败状态。

交付前执行：

```bash
npm run lint
npm run typecheck
npm test
npm run build
npx playwright test
```

## 16. 风险与回滚

- 新增字段使用追加 migration，旧评论数据允许为空；
- Turnstile 未配置时按设置明确选择“游客评论关闭”或“开发模式跳过”，不能静默认为验证成功；
- Gravatar 是外部依赖，必须保留 identicon 回退；
- 个人页和文章页组件迁移采用兼容 props，先替换调用方再删除旧作者块；
- 若任一阶段回归失败，可回滚对应 migration 和页面调用方，不影响现有登录、会员和评论审核数据。

