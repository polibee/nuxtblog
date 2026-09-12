# P06 Navigation（按 navigation-menu-design.md 规格重做）

## 1. 基本信息

~~~text
Phase ID: P06
Phase Name: Navigation（依据 docs/Blog-Framework-navigation-menu-design.md 全量规格重做）
Owner: polibee
NuxtAdmin Base Commit: a48695f
Depends On: P00, P04, P05
Target Version: v0.2.0-p06
Status: COMPLETE
~~~

## 2. 实现范围（对照规格 §15 的 P06.1-P06.3）

### P06.1 数据模型

- 四表模型（规格 §6）：navigations（key UNIQUE + location UNIQUE header/footer + admin_name + enabled）、navigation_variants（UNIQUE(navigation_id, locale_id)、default_flag 生成列 if(is_default, navigation_id, null) 实现"每位置每 Locale 至多一个默认版本"）、navigation_items（variant 作用域树 + type(page|post|category|custom) + target_entity_type/target_entity_id + open_in_new_tab/rel/enabled）、navigation_item_translations（label + custom_url + title_attribute + nofollow，UNIQUE(item, locale)）。
- 迁移：0010（drop 旧三表 + 建新四表）+ 0011（修正 default_flag 生成表达式为按 navigation 分组）。禁列表（label_zh/url_en、JSON items、落库最终 URL）均未违反。
- 迁移 0010 的教训已记录：mysql2 单语句限制 → 每条 DROP 必须用 statement-breakpoint 分隔；重复 breakpoint 会产生空语句失败。

### P06.2 管理端

- API（§8.1 核心集）：GET /api/admin/navigations（位置+variants 元数据）、GET /api/admin/navigations/:id/variants/:locale（编辑器树）、POST /api/admin/navigations/:id/variants（创建 Variant，支持 copyFromVariantId 深拷贝）、PUT /api/admin/navigation-variants/:variantId/tree（整树事务替换）、DELETE variant。
- saveNavigationTree 服务端校验（§7.2）：深度 ≤3（超出 422）、父子循环 422、Custom URL 协议白名单（相对/http(s)/mailto/tel，422）、Entity 存在性 422、逐项 label 必填；整树单事务替换；保存后失效 navigation:{location}:{locale} 缓存。
- 可视化编辑器（§4）：NavigationManagerPage（位置 ▼ + 语言 ▼[仅 enabled+content] + 保存 + clean/dirty/saving/saved/error 状态）+ 左侧 Picker（页面/自定义链接/分类目录/文章四个 Tab，搜索+多选+添加；自定义链接 URL+文字）+ 右侧 NavigationTree（HTML5 拖拽排序/嵌套、深度与自环防护、展开/折叠、行内编辑 label/URL/Title/rel/新窗口/nofollow、隐藏/删除、↑↓← 键盘移动替代）。
- RBAC：navigation.view/edit/delete（permissionPrefix navigation，当前仅 admin '*'）；Server 端逐 handler requirePermission。

### P06.3 公开端

- resolveNavigation(location, locale)（§7.3）：缓存命中 → Variant（缺失时回退默认语言版本并标记 fallbackUsed，开发策略）→ 状态 disabled → 空菜单 → 逐项 URL 按 Variant Locale 解析（page→/pages/slug、post→/posts/slug、category→/category/slug、custom→custom_url）→ 目标缺失/未发布/该语言无翻译的项隐藏 → 树组装。
- 公开 API：GET /api/public/navigation?location=header&locale=zh-CN，返回 { location, locale, fallbackUsed, items }（§8.2 DTO）。
- 组件：SiteHeader（品牌+水平导航+语言切换器+后台入口）、SiteFooter（版权+竖排导航）、NavigationMenu（递归渲染公开 DTO、外链 _blank+rel）、LanguageSwitcher（读写 blog_locale cookie，v1 原地刷新；内容级 URL 映射属 P20）；公开布局已接入，SSR 输出导航。
- 缓存：KV key navigation:{location}:{locale}，TTL 300s；菜单保存/删除即失效。内容变更（§11 事件清单）v1 依赖 TTL 兜底（已在 Known Issues 记录）。

## 3. 迁移与数据

~~~text
0010_navigation_v2.sql：DROP 旧三表（仅含种子数据）+ CREATE 新四表
0011_variant_default_flag.sql：default_flag 生成表达式按 navigation 分组
Seed：ensureDefaultNavigations 按 variant 级自愈（缺失才补），header/footer 各建 zh-CN 默认版本 + 首页项
~~~

## 4. 验证结果

~~~text
npm run lint      → PASS
npm run typecheck → PASS
npm test          → PASS（122 tests / 18 files）
npm run build     → PASS
集成/浏览器       → 编辑器页渲染（位置/语言选择、picker、树、状态）、公开 DTO（zh-CN 首页项 + fallbackUsed:false）、
                    header/footer 由菜单驱动渲染（浏览器快照）、dev-credentials 端点生产 404 逻辑就位
~~~

## 5. 完成记录

~~~text
Phase Status: COMPLETE
Acceptance: PASS
Known Issues:
  - 公开解析的缓存失效目前依赖菜单保存 + 300s TTL；内容发布/下线事件（§11 完整清单）的精细失效留待 P19
  - LanguageSwitcher 为 v1（cookie + 刷新），内容级 URL 映射随 P20 多语言激活
  - 菜单树整树替换保存（项 id 会变化），满足规格的不可变结构要求留待 Enhancement
  - 拖拽为 HTML5 原生实现（无第三方库）；键盘移动提供 ↑↓← 替代
Follow-up: P07 Comments；P20 语言切换器内容级映射
~~~
