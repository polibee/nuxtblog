# P35 Core Settings（设置.txt S3）

## 1. 基本信息

~~~text
Phase ID: P35
Phase Name: Core Settings Pages（Media/Comments/SEO/Search/RSS）
Owner: polibee
NuxtAdmin Base Commit: a48695f
Depends On: P34（Settings Foundation）
Target Version: v0.2.0-p35
Status: COMPLETE
设计依据：docs/设置.txt §20-24/53/76（S3 阶段）
~~~

## 2. 实现范围（摘要）

- **Media**（§20）：上传（最大体积/保留原图）+ 图片处理（生成变体/移除 EXIF/默认质量）——尺寸变体等系统 preset 不开放给普通管理员
- **Comments**（§21）：常规（启用/游客评论/游客邮箱/最大长度）+ 审核（先审后显）；require_guest_email 带 visibleWhen: guest_enabled（§55 条件字段实测）
- **SEO**（§22）：标题模板（{site} {page} 变量）/默认 OG 图 + 收录开关（文章/页面/搜索页 noindex）+ Sitemap（启用/包含图片）——仅全局默认，单页 SEO 在实体上
- **Search**（§23）：启用/每页结果数/包含商品（SQL LIKE 第一版，Provider 扩展后置）
- **RSS**（§24）：启用/标题/条数/全文/特色图
- **模块可见性**（§53/76）：SettingsPageDef.module 字段（comments → comments.view 权限探测）；导航与搜索索引同时过滤，模块禁用页面自动消失、DB 值保留
- 全部为 Schema 注册（零页面代码），消费者按 §68 逐步接入——新增 setting 无需 DB seed

## 3. 验证结果

~~~text
npm run lint      → PASS
npm run typecheck → PASS
npm test          → PASS（167 tests / 21 files）
npm run build     → PASS
真实环境 E2E     → PASS（导航 10 页 + comments 条件字段 + module 标记）
~~~

## 4. E2E 验证

- GET settings-ui → 10 页（publishing 组 5 页），search entries 17→51
- comments 页字段 visibleWhen（guest 关 → 邮箱字段隐藏）由前端 isFieldVisible 消费 ✓
- module: 'comments' 标记出现在导航元数据 ✓

## 5. 完成记录

~~~text
Phase Status: COMPLETE（S3）
Acceptance: PASS
Known Issues: media/comments/seo/rss 的消费端接线（读取这些键替代硬编码）按模块逐步跟进
Follow-up: S4 Business Settings（Store/Membership/Payments/Advertising/Friend Links/Analytics）按同模式注册即可
~~~
