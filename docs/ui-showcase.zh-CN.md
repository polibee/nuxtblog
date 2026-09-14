# 中英文界面截图与功能索引

> 截图基于本地 MySQL 演示数据采集，页面中的账号、订单、通知地址、密钥和数据库连接信息均不纳入截图。本文档记录可复现的截图入口与验收范围；打开链接即可查看对应实时页面。

## 前台页面

| 功能 | 中文页面 | 英文页面 | 截图验收重点 |
| --- | --- | --- | --- |
| 首页、文章卡片、布局切换、分页 | [中文首页](http://127.0.0.1:3001/) | [English home](http://127.0.0.1:3001/en) | 页眉语言切换、文章列表/网格、浏览量与评论数、分页、作者侧栏卡片、页脚分组 |
| 文章内容页 | [中文文章](http://127.0.0.1:3001/posts/nuxt4-blog-start) | [English article](http://127.0.0.1:3001/en/posts/demo-coffee-and-code) | 标题、元信息、正文图片自适应、链接卡片、作者简化卡片、评论区 |
| 作者公开主页 | [中文主页](http://127.0.0.1:3001/profile) | [English profile](http://127.0.0.1:3001/en/profile) | 公开资料、项目卡片预览图、社交渠道、响应式布局 |
| 友链 | [中文友链](http://127.0.0.1:3001/friends) | [English friends](http://127.0.0.1:3001/en/friends) | 友链列表、申请表单、字段校验、游客提交状态 |
| 广告购买 | [中文广告](http://127.0.0.1:3001/advertising) | [English advertising](http://127.0.0.1:3001/en/advertising) | 广告位、周期价格、预算、审核提示和购买入口 |
| 商城与会员 | [中文商城](http://127.0.0.1:3001/store) | [English store](http://127.0.0.1:3001/en/store) | 商品、库存状态、购买入口、会员权益 |
| 站点地图 | [中文站点地图](http://127.0.0.1:3001/sitemap) | [English sitemap](http://127.0.0.1:3001/en/sitemap) | 页面、文章、分类、标签和公开资源发现 |

## 后台管理页面

管理员登录后采集以下页面。后台截图应覆盖列表、表单、详情、权限和错误反馈，而不截图密码输入框、API key 或数据库连接串。

| 功能 | 中文入口 | 英文入口/切换 | 截图验收重点 |
| --- | --- | --- | --- |
| 仪表盘 | [/admin](http://127.0.0.1:3001/admin) | 在右上角 Language 切换 English | 用户、文章、页面、评论、缓存监控和“访问站点” |
| 文章管理 | [/admin/posts](http://127.0.0.1:3001/admin/posts) | 同页切换 English | 语言筛选、列表、分页、创建/编辑/预览 |
| 页面管理 | [/admin/pages](http://127.0.0.1:3001/admin/pages) | 同页切换 English | 默认页面、Alias、空内容保存、编辑回填 |
| 导航管理 | [/admin/navigations](http://127.0.0.1:3001/admin/navigations) | 同页切换 English | 页眉/页脚分组、Alias、语言 variant、前台关联 |
| 评论管理 | [/admin/comments](http://127.0.0.1:3001/admin/comments) | 同页切换 English | 审核、管理员回复、游客元信息、分页和导出 |
| 广告计划 | [/admin/advertising/campaigns](http://127.0.0.1:3001/admin/advertising/campaigns) | 同页切换 English | 审核材料、订单流水、价格快照、预算与投放状态 |
| 广告位/投放 | [/admin/advertising/slots](http://127.0.0.1:3001/admin/advertising/slots) | 同页切换 English | 响应式广告位、价格配置、创意、曝光/点击统计 |
| 通知渠道 | [/admin/notifications](http://127.0.0.1:3001/admin/notifications) | 同页切换 English | 渠道、订阅、outbox、delivery、失败重试 |
| AI 助手与分析 | [/admin/ai-assistant](http://127.0.0.1:3001/admin/ai-assistant) | 同页切换 English | 模型设置、输入/输出/token/cache/cost 只读分析 |
| 设置 | [/admin/settings/general](http://127.0.0.1:3001/admin/settings/general) | 同页切换 English | 分组切换、站点信息、SEO、统计代码和验证字段 |
| 作者卡片 | [/admin/author-card](http://127.0.0.1:3001/admin/author-card) | 同页切换 English | 侧栏卡片数据、社交渠道和公开主页关联 |
| 数据清理 | [/admin/database](http://127.0.0.1:3001/admin/database) | 同页切换 English | 测试数据范围、二次确认、清理结果和保护规则 |

## 截图采集约定

1. 桌面端使用 1440×900 或浏览器当前桌面视口；移动端使用 390×844，分别验证导航折叠、卡片换行和表格横向滚动。
2. 中文文档只引用中文页面入口，英文文档只引用英文页面入口；管理端通过右上角 Language 控件切换，不通过猜测 URL 参数切换。
3. 采集前先清除测试弹窗和敏感字段；截图文件若提交，统一放入 `docs/screenshots/`，文件名使用 `public-home-zh.png`、`admin-dashboard-en.png` 这类稳定命名。
4. 当前数据库兼容基线是 Laragon MySQL；PostgreSQL/Supabase 仍按项目审计结论暂缓，不在截图中宣称已验证。

