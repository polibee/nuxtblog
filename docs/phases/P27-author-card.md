# P27 侧边栏 Author Card（作者卡片）

## 1. 基本信息

~~~text
Phase ID: P27
Phase Name: 侧边栏作者卡片（author 类型 + 可视化编辑器 + 300px 实时预览）
Owner: polibee
NuxtAdmin Base Commit: a48695f
Depends On: P00b（侧边栏卡片）、P16.5（卡片类型）、P20（Media 资产中心）
Target Version: v0.2.0-p27
Status: COMPLETE
设计依据：docs/Author Card 设计方案（79 节）
~~~

## 2. 实现范围（摘要）

- **数据层（0028）**：sidebar_cards += config json（类型专属配置存储层，后台绝不手编 JSON，§45/46）
- **配置 Schema**（shared/schemas/author-card.ts）：displayName(≤50)/headline(≤80)/bio(≤160)/avatarMediaId/avatarStyle(circle|rounded)/layout(centered|compact)/show 开关×5/socialLinks(≤8，platform 枚举 + URL 校验 + label)/cta(label≤30 + URL 校验 + target)
- **公开解析**（§57/58）：sidebar-card.service author 分支——config → ResolvedAuthorCard（头像经 media 解析、socials 截前 5、cta external 判定）；author 行不要求翻译字段
- **前台 AuthorCardView**：Centered / Compact 双布局、80px(64 compact) 头像 circle/rounded、名字 18px semibold、headline 13px muted、bio 14px line-clamp-4、社交 ghost 图标 32px（lucide，aria-label + title，外链 rel noopener，最多 5 个）、CTA outline sm（内链 NuxtLink / 外链 a noopener）
- **后台编辑器**（§41-44）：/admin/author-card——左侧 300px 实时侧边栏预览（非自动保存），右侧可视化表单：基本信息（名称*/身份描述/简介+bio 长度提示）/头像 MediaPicker(usage=avatar, 512×512)/社交动态行（平台+URL+备注，增删，≤8）/CTA（文字/目标/打开方式）/外观（布局/头像形状）/显示开关×5
- 新端点：GET/PUT /api/admin/sidebar/author-card（创建或更新 author 类型卡片行）
- SidebarCardResource 类型选项 += 作者卡片（列表可启停/排序）

## 3. 验证结果

~~~text
npm run lint      → PASS（0 errors；既有 v-html 警告 1 条可接受）
npm run typecheck → PASS
npm test          → PASS（167 tests / 21 files）
npm run build     → PASS
真实环境 E2E      → PASS
~~~

## 4. E2E 验证

- PUT author-card（William Lee / Developer · Writer / bio / github+email 社交 / About Me CTA /circle centered）→ 200
- GET /api/public/sidebar → author 卡返回 resolved payload（socials [github,email]、cta About Me）
- 首页 SSR 渲染：William Lee ×2（alt+名字）、About Me → CTA 在位

## 5. 完成记录

~~~text
Phase Status: COMPLETE
Acceptance: PASS（四道闸门 + E2E；核心验收项全部落地，除 Source=User/Current Post Author 与显示位置条件）
Known Issues: source 仅 custom（user/current_post_author 为多作者阶段预留）；显示位置条件（首页/文章/页面 checkbox）未做
Follow-up: User Source 读取用户资料、Current Post Author、显示位置条件、Person JSON-LD 统一输出
~~~
