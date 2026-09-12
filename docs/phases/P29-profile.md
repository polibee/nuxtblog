# P29 /profile 模块化作者简历页

## 1. 基本信息

~~~text
Phase ID: P29
Phase Name: Author Profile Page（/profile 模块化简历页）
Owner: polibee
NuxtAdmin Base Commit: a48695f
Depends On: P03（Media）、P27（Author Card 数据共享）
Target Version: v0.2.0-p29
Status: COMPLETE
设计依据：docs/ai优化.txt §1-2（/author → /profile 重定位 + Profile Page 模块化设计）
~~~

## 2. 实现范围（摘要）

- **数据层（0030 迁移 + schema/profile.ts）**：author_profile（单行：displayName/headline/bio/avatar_media_id/location/hero_config）+ 8 张集合表（social_channels 带 showInSidebar/showInHero/showInSocial 三开关、page_sections 带 type UNIQUE/enabled/sort_order、experiences、projects、skills（group_name）、education、certifications、focus_items）
- **服务层**（server/modules/profile/profile.service.ts）：getProfileBundle（编辑全量读）/ saveProfileBundle（单事务整包替换：profile upsert + 集合 replace-all + sections 按 type upsert）/ getPublicProfile（sections 过滤 enabled 按序渲染、头像与项目封面解析 /media URL、tags 拆分、focusItems 映射）/ getAuthorCardExtras（showInSidebar 渠道 → 侧边栏作者卡片共享）
- **Admin API**：GET/PUT /api/admin/author/profile（profile.view / profile.edit 权限；编辑者角色新增这两项权限，查看者新增 profile.view）
- **公开端点**：GET /api/public/profile（无数据返回 null/204；前台页面显示空态）
- **前台页面**（app/pages/profile.vue，public-full 布局）：Hero（头像/姓名/headline/location/heroSocials 图标行）+ 按后台排序渲染已启用区块——About（多行文本）、Experience（时间线 + 在职徽标 + 链接）、Projects（封面卡 + 标签 + featured 徽标 + Visit/GitHub 链接）、Skills（分组徽标）、Social/Contact（渠道卡片列表）、Focus（清单）、Education、Certifications；useSeoMeta 注入姓名/身份描述
- **后台编辑页**（app/modules/author/，资源 author-profile → 内容组）：基本信息表单 + MediaPicker 头像 + 9 区块启用/上下排序 + 社交渠道/经历/项目（含图片选择、featured、tags）/技能/教育/证书/当前专注各集合编辑器（添加/删除/排序）；一键整包保存，页头「查看公开页」直链
- ~~作者卡片数据共享~~（**已于 2026-09-12 按用户要求回退**：作者卡片与 /profile 是两个东西——卡片社交链接与 CTA 完全由卡片自身配置决定，不再读取 profile 渠道，也无默认 /profile CTA；getAuthorCardExtras 已删除，author_social_channels.showInSidebar 列保留但停用）
- socialIcon（app/utils/socialIcons.ts）：平台→lucide 图标共享映射，AuthorCardView 与 /profile 复用；iconMap 补充 sparkles/user-round

## 3. 验证结果

~~~text
npm run lint      → PASS（0 errors；既有 v-html 警告 1 条可接受）
npm run typecheck → PASS
npm test          → PASS（167 tests / 21 files）
npm run build     → PASS
~~~

## 4. E2E 验证

- PUT /api/admin/author/profile 整包保存（3 渠道/2 经历/1 项目/3 技能/教育/证书/2 专注，education+certifications 区块禁用）→ GET 回读一致
- GET /api/public/profile 返回 PublicProfile（sections 过滤后 7 项；socials 仅 showInSocial 2 项；heroSocials 仅 github）
- GET /profile DOM 标记：姓名/身份/所在地/工作经历/Acme Corp/项目/技能/当前专注/联系方式 全部渲染；禁用区块标题（教育经历/证书 h2）0 次出现（数据仅在 payload 中，不渲染）✓
- 侧边栏：/api/public/sidebar 作者卡片社交链接 = profile showInSidebar 渠道（github+website，email 正确排除）；清空卡片 CTA 后自动回退「View Profile → /profile」，恢复原 CTA 后仍显示原配置（优先级正确，原配置已还原）✓

## 5. 完成记录

~~~text
Phase Status: COMPLETE
Acceptance: PASS（四道闸门 + 全链路 E2E）
Known Issues: heroConfig 字段已预留未接入 UI（后续视觉配置）；区块 config JSON 尚未使用
Follow-up: 导航菜单可加 /profile 入口；A3 Page AI 上线后 profile 页可被分析
~~~
