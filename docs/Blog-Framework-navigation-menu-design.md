# 博客框架导航菜单模块设计

## Nuxt 4 + NuxtAdmin + MySQL 全栈实现规格

**文档类型：** 可直接交给其他 AI 开发的独立模块规格  
**适用范围：** 通用博客框架  
**依赖基线：** Blog Framework 主架构文档、Nuxt 4、Nitro、NuxtAdmin、MySQL、Entity + Translation 多语言模型  
**目标版本：** v1.0  
**核心能力：** 页眉菜单、页脚菜单、多语言菜单、WordPress 风格可视化菜单编辑器

---

## 1. 开发任务摘要

请实现一个类似 WordPress 菜单管理器的博客导航模块。

管理员可以分别管理：

~~~text
页眉菜单 Header Navigation
页脚菜单 Footer Navigation
~~~

每个菜单支持添加：

~~~text
页面 Page
自定义链接 Custom Link
分类目录 Category
文章 Post
~~~

系统从数据库启用的 Content Locale 动态生成语言版本：

~~~text
中文菜单 zh-CN
英文菜单 en-US
其他语言菜单
~~~

公开网站切换语言时，页眉和页脚自动切换到当前语言对应的菜单版本。

开发阶段只启用 zh-CN，但数据库、后台页面和 API 必须从第一天支持其他 Locale，不允许未来通过新增字段或重构表结构补多语言。

## 2. 设计目标

### 2.1 必须实现

- Header 和 Footer 分开管理
- 每个菜单位置支持多个 Locale 版本
- WordPress 风格的可视化菜单编辑器
- 左侧添加菜单项，右侧编辑菜单结构
- 菜单项拖拽排序
- 菜单项拖拽嵌套
- 最大层级限制
- Page、Post、Category、Custom Link 四类菜单项
- 菜单项编辑、隐藏、删除
- 当前 Locale 自动解析标题和 URL
- 语言切换时切换对应导航版本
- 目标内容缺失 Translation 时有明确行为
- Header/Footer 前台 SSR 输出
- 菜单缓存和保存后的缓存失效
- NuxtAdmin RBAC

### 2.2 不在本模块实现

- Mega Menu
- 菜单图标市场
- 菜单权限按会员等级控制
- 菜单 A/B Test
- 菜单点击热力图
- 菜单内广告竞价
- 无限层级
- 拖拽生成任意页面布局

v1 推荐最大层级为 3 层：

~~~text
一级菜单
└── 二级菜单
    └── 三级菜单
~~~

## 3. 与现有博客框架的关系

本模块必须遵循主架构文档：

~~~text
Nuxt 4 + Nitro
NuxtAdmin Resource/Widget/RBAC
MySQL + Repository
Entity + Translation
Locale Registry
Service 事务
公开路由严格按 Locale 查询
~~~

### 3.1 NuxtAdmin 接入

复用：

- Admin Panel
- Resource Registry
- RBAC
- UiCard、UiTabs、UiSelect、UiButton、UiInput、UiEmpty
- Toast/Notification
- Settings
- Events
- Page Cache

新增业务页面：

~~~text
app/modules/navigation/
├── module.ts
├── admin/
│   ├── NavigationResource.ts
│   ├── NavigationManagerPage.vue
│   ├── NavigationMenuSelector.vue
│   ├── NavigationItemPicker.vue
│   ├── NavigationTree.vue
│   ├── NavigationTreeItem.vue
│   └── NavigationItemEditor.vue
└── components/
~~~

### 3.2 与现有 Menu 模块的迁移

NuxtAdmin 当前 Menu 示例使用一个包含嵌套 items 的数据结构。该结构可以用于 Demo，但不满足：

- 每个 Locale 独立菜单
- Page/Post/Category 的 Entity 引用
- 当前 Locale URL 解析
- Slug 变更后的动态链接
- Translation 缺失检测
- 菜单项级别的可视化编辑和校验

因此生产实现应把现有 Menu Demo 替换为本模块的关系型 Navigation 模型。

可以复用现有 Menu 的 UI 原子组件和导航入口，但不得继续把正式菜单保存为一个未经约束的 JSON items 字段。

## 4. 用户体验设计

### 4.1 菜单管理入口

后台导航：

~~~text
Appearance
└── Navigation
~~~

如果系统当前没有 Appearance 分组，可以放在 Content 分组。

页面标题：

~~~text
Navigation Menus
~~~

页面顶部提供：

~~~text
[菜单位置：Header ▼] [语言：简体中文 ▼] [保存菜单]
~~~

菜单位置必须至少有 Header 和 Footer。位置名称走 UI i18n，不存为可见业务文本。

### 4.2 WordPress 风格布局

桌面端：

~~~text
┌────────────────────────────────────────────────────────────┐
│ Navigation   [位置 ▼] [语言 ▼] [保存菜单]                 │
├───────────────────────┬────────────────────────────────────┤
│ 添加菜单项            │ 菜单结构                           │
│                       │                                    │
│ ▼ 页面                │ ┌ 首页                         ⋮ │ │
│   □ 关于              │ ├ 文章                         ⋮ │ │
│   □ 联系              │ │  └ 分类目录                   ⋮ │ │
│   [添加到菜单]        │ ├ 自定义链接                   ⋮ │ │
│                       │                                    │
│ ▼ 自定义链接          │ [保存菜单]                         │
│   URL                 │                                    │
│   链接文字            │                                    │
│   [添加到菜单]        │                                    │
│                       │                                    │
│ ▼ 分类目录            │                                    │
│   搜索/选择           │                                    │
│   [添加到菜单]        │                                    │
│                       │                                    │
│ ▼ 文章                │                                    │
│   搜索/选择           │                                    │
│   [添加到菜单]        │                                    │
└───────────────────────┴────────────────────────────────────┘
~~~

移动端使用上下布局：顶部是位置/语言/保存，中部是添加面板，底部是菜单结构。

### 4.3 位置和语言选择

位置：

~~~text
Header
Footer
~~~

语言只显示：

~~~text
enabled=true
content_enabled=true
~~~

开发阶段只有 zh-CN。未来启用 en-US 后，自动出现 Header/Footer 的 English 版本。

### 4.4 菜单版本状态

每个位置和语言组合都有一个菜单版本：

~~~text
Header + zh-CN
Header + en-US
Footer + zh-CN
Footer + en-US
~~~

状态：

~~~text
draft
published
disabled
~~~

v1 可以先使用 enabled=true/false，但数据库保留 status 字段，方便未来增加发布工作流。

### 4.5 左侧添加菜单项

左侧使用 Tabs 或 Accordion：

~~~text
页面
自定义链接
分类目录
文章
~~~

每种类型有独立的搜索、选择和添加操作。

页面：

- 搜索页面标题
- 按当前菜单 Locale 显示 Page Translation 标题
- 只显示可以公开访问的页面
- 支持多选
- 添加后按选择顺序进入菜单底部

分类目录：

- 搜索分类名称
- 显示层级路径
- 按当前菜单 Locale 显示 Category Translation
- 支持多选

文章：

- 搜索文章标题
- 按当前菜单 Locale 显示 Post Translation
- 只显示已发布且存在完整 Translation 的文章
- 支持多选

自定义链接字段：

~~~text
URL
链接文字
Title 属性
打开方式
~~~

允许相对 URL、http/https，可选 mailto/tel；禁止 javascript、data、vbscript。新窗口自动增加 noopener noreferrer，nofollow 作为可选 SEO 设置。

### 4.6 右侧菜单结构

菜单项显示：

~~~text
拖拽手柄
标题
类型
目标摘要
展开/折叠按钮
更多操作按钮
~~~

操作：

~~~text
编辑
隐藏
复制
删除
~~~

展开后显示：

~~~text
Navigation Label
Target
Title Attribute
Open in New Tab
Rel
Enabled
~~~

Page/Post/Category 的 Target 只读显示 Entity 引用，URL 由当前 Locale 动态解析。Custom Link 的 URL 和 Label 可编辑。

### 4.7 拖拽规则

支持同级排序、拖入成为子项、拖回一级、展开/折叠子树，并提供键盘上下移动作为无障碍替代。

限制：

~~~text
最大深度 = 3
同一菜单项不能成为自己的后代
不能形成循环父子关系
禁用父项时默认同时隐藏子树
~~~

拖拽只更新本地草稿，点击保存后才写入数据库。

### 4.8 保存和未保存状态

页面状态：

~~~text
clean
dirty
saving
saved
error
~~~

离开 dirty 页面时显示：

~~~text
保存并离开
放弃修改
取消
~~~

保存必须是一个事务：

~~~text
更新菜单版本
新增/更新/删除菜单项
更新父级和排序
写入菜单项字段
提交 navigation.updated 事件
清除相关缓存
~~~

任一步失败，整个保存回滚。

## 5. 多语言导航设计

### 5.1 核心决策

同一位置，不同 Locale 使用不同菜单版本：

~~~text
Header / zh-CN
├── 首页
├── 文章
├── 分类
└── 关于

Header / en-US
├── Home
├── Blog
├── Categories
└── About
~~~

不能使用 label_zh、label_en 等字段。

### 5.2 菜单切换规则

公开请求进入时：

~~~text
locale = resolveLocale(request)
navigation = resolveNavigation(location, locale)
~~~

解析顺序：

1. 查找 location + locale 的 enabled 菜单版本。
2. 找到则使用该版本。
3. 找不到时根据 Settings 的 fallback 策略处理。
4. 返回前对每个菜单项重新解析目标 URL。
5. 目标 Translation 不存在或不可公开时隐藏该项。

推荐：

~~~text
开发阶段：允许 fallback 到默认语言
已启用多语言的正式环境：默认 strict
~~~

严格模式下，当前 Locale 没有菜单版本时返回空菜单或隐藏该位置。默认语言回退模式下才使用默认 Locale 菜单。

默认回退不是把英文内容显示成中文的理由。Entity Link 仍必须根据当前请求 Locale 解析，目标 Translation 缺失时隐藏。

### 5.3 菜单项标题规则

Page/Post/Category：

~~~text
navigation_item_translation.label override
→ target_entity_translation.title/name
→ 无标题则隐藏
~~~

Custom Link 必须有 navigation_item_translation.label。

### 5.4 菜单项 URL 规则

Page、Post、Category 只保存 Entity 引用，解析时读取当前 Locale 的 Translation Slug。

Custom Link 使用当前 Locale 版本保存的 custom_url。

不能保存已经解析好的 Page URL 作为最终值，否则目标 Slug 变化后菜单会失效。

### 5.5 语言切换器

语言切换器需要：

1. 读取当前页面 Entity 和当前 Translation。
2. 如果目标 Locale 有对应 Translation，生成同一内容的目标 URL。
3. 如果不存在，按产品策略跳转目标 Locale 首页或保持当前页。
4. Header/Footer 重新调用 Navigation Resolver。
5. 缓存 Key 使用目标 Locale。

导航菜单不需要由语言切换器手工替换；请求 Locale 正确时，Header/Footer 自动读取对应版本。

## 6. 数据库设计

推荐四张表，支持独立语言菜单、独立菜单结构和 Entity 引用。

### 6.1 navigations

逻辑菜单位置。

~~~text
navigations
├── id
├── key
├── location
├── admin_name
├── enabled
├── created_at
└── updated_at
~~~

location 为 header 或 footer。admin_name 只用于后台管理。

约束：

~~~text
UNIQUE(key)
UNIQUE(location)
~~~

v1 每个 location 一个逻辑 Navigation，未来可扩展为同一位置多个菜单组。

### 6.2 navigation_variants

每个位置的语言版本。

~~~text
navigation_variants
├── id
├── navigation_id
├── locale_id
├── status
├── is_default
├── created_at
└── updated_at
~~~

约束：

~~~text
UNIQUE(navigation_id, locale_id)
最多一个同一 Navigation 的默认 Variant
~~~

开发阶段生成 Header + zh-CN 和 Footer + zh-CN。启用英文后由管理员创建 Header + en-US 和 Footer + en-US。

### 6.3 navigation_items

菜单项结构和目标引用。

~~~text
navigation_items
├── id
├── navigation_variant_id
├── parent_id nullable
├── type
├── target_entity_type nullable
├── target_entity_id nullable
├── sort_order
├── enabled
├── open_in_new_tab
├── rel
├── created_at
└── updated_at
~~~

type：

~~~text
page
post
category
custom
~~~

Page/Post/Category 必须有 target_entity_type 和 target_entity_id。Custom 必须为空，custom_url 在 Translation 表保存。

同一目标 Entity 可以在同一菜单中出现多次，每个菜单项 ID 独立。

### 6.4 navigation_item_translations

菜单项语言内容。

~~~text
navigation_item_translations
├── id
├── navigation_item_id
├── locale_id
├── label
├── custom_url nullable
├── title_attribute nullable
├── nofollow
├── created_at
└── updated_at
~~~

约束：

~~~text
UNIQUE(navigation_item_id, locale_id)
INDEX(locale_id)
~~~

服务层必须保证 Translation Locale 等于所属 Variant Locale。

### 6.5 禁止的设计

禁止按语言建表或建列：

~~~text
header_menu_zh
header_menu_en
label_zh
label_en
url_zh
url_en
~~~

禁止把正式菜单全部保存为不可查询的 JSON items。JSON 可以作为导入导出载荷，但最终数据必须落到关系表。

## 7. Domain Service

### 7.1 Navigation Service

~~~text
listNavigations()
getNavigationByLocation(location)
getNavigationVariant(navigationId, locale)
createNavigationVariant(...)
updateNavigationVariant(...)
saveNavigationTree(...)
duplicateNavigationVariant(...)
deleteNavigationItem(...)
resolveNavigation(location, locale)
resolveNavigationItem(item, locale)
invalidateNavigationCache(location, locale)
~~~

### 7.2 saveNavigationTree

输入：

~~~text
{
  navigationVariantId,
  items: [
    {
      id?,
      parentId?,
      type,
      targetEntityType?,
      targetEntityId?,
      label,
      customUrl?,
      titleAttribute?,
      openInNewTab,
      rel,
      nofollow,
      enabled,
      sortOrder
    }
  ]
}
~~~

服务端执行：

1. 验证 navigation.edit。
2. 验证 Variant 和 Locale。
3. 验证数量、重复 ID、循环父子关系和最大层级。
4. 验证 Page/Post/Category Entity。
5. 验证 Custom URL 协议。
6. 验证菜单项 Translation。
7. 在数据库事务中保存结构。
8. 发出 navigation.updated。
9. 清除对应 Location + Locale 缓存。

### 7.3 resolveNavigation

~~~text
resolveNavigation(location, requestedLocale)
  → resolve Locale
  → 查找 navigation
  → 查找 navigation_variant
  → 按 fallback 策略处理缺失 Variant
  → 读取 items
  → 校验层级和 enabled
  → 解析 Entity URL
  → 隐藏无 Translation/不可访问/无效链接
  → 构建树
  → 排序
  → 返回公开 DTO
~~~

公开 DTO 不返回管理备注、权限字段、敏感目标字段和未清洗 URL。

## 8. API 设计

### 8.1 后台 API

~~~text
GET    /api/admin/navigations
GET    /api/admin/navigations/:navigationId/variants/:locale
POST   /api/admin/navigations/:navigationId/variants
PUT    /api/admin/navigation-variants/:variantId/tree
POST   /api/admin/navigation-variants/:variantId/items
PUT    /api/admin/navigation-items/:itemId
DELETE /api/admin/navigation-items/:itemId
POST   /api/admin/navigation-variants/:variantId/duplicate
~~~

copyFromVariantId 用于复制语言菜单。复制后必须创建新的 Item 和 Translation，不共享可变结构。

### 8.2 公开 API

~~~text
GET /api/public/navigation?location=header&locale=zh-CN
~~~

返回：

~~~text
{
  location,
  locale,
  fallbackUsed,
  items: [
    {
      label,
      url,
      titleAttribute,
      target,
      rel,
      children: []
    }
  ]
}
~~~

前台 SSR 可以直接调用 Navigation Service；公开 API 主要供客户端菜单、预览或主题使用。

## 9. 权限设计

~~~text
navigation.view
navigation.create
navigation.edit
navigation.delete
navigation.publish
~~~

后台入口和读取需要 navigation.view。添加、编辑、排序、翻译需要 navigation.edit。删除需要 navigation.delete。发布需要 navigation.publish；没有独立发布流程时可以暂时复用 navigation.edit。

Server API 必须再次执行权限，不能只依赖前端按钮隐藏。

## 10. URL 和安全校验

Custom Link 允许相对 URL、http/https，可选 mailto/tel；禁止 javascript、data、vbscript。Server 必须校验，前端校验只用于即时反馈。

Entity Link 只保存 target_entity_type 和 target_entity_id，解析时根据 requestedLocale、目标 Entity、目标 Translation 和 route resolver 生成 URL。

以下目标默认不显示在公开菜单：

- 不存在
- 已删除
- 未发布
- 当前 Locale Translation 缺失
- 当前 Locale Translation 不完整

后台菜单树需要显示目标不存在、缺少翻译、尚未发布或无法解析等警告。

## 11. 缓存和事件

~~~text
navigation:{location}:{locale}
navigation:header:zh-CN
navigation:footer:en-US
~~~

以下事件清除对应缓存：

~~~text
navigation.created
navigation.updated
navigation.deleted
navigation.variant.created
navigation.variant.updated
navigation.item.updated
navigation.item.deleted
content.published
content.unpublished
content.afterUpdate
content.afterDelete
locale.enabled
locale.disabled
translation.updated
~~~

Page/Post/Category 的 Slug、发布状态或 Translation 变化时，至少清除引用它的当前 Locale 菜单缓存。无法高效查找引用关系时，v1 可以清除该 Locale 的 Header/Footer 菜单缓存，但不能清除所有站点缓存。

## 12. 前台渲染

共享组件：

~~~text
app/components/public/SiteHeader.vue
app/components/public/SiteFooter.vue
app/components/public/NavigationMenu.vue
app/components/public/NavigationMenuItem.vue
app/components/public/LanguageSwitcher.vue
~~~

前台组件只渲染公开 DTO，不直接读取数据库，不直接解析 Entity 引用。

Header 默认支持 Logo、一级菜单、多级下拉、Language Switcher 和移动端菜单。Footer 默认支持 Footer 菜单、版权文本和语言相关站点设置。Footer 多列布局作为后续增强，v1 先实现一个 Footer Navigation 位置。

## 13. 可访问性

必须使用 nav/ul/li 语义结构；菜单按钮有 aria-label；展开项有 aria-expanded；子菜单可用键盘访问；Tab、Enter、Escape 可操作；拖拽提供键盘排序替代；移动端菜单可由屏幕阅读器关闭。

## 14. 测试和验收

### 14.1 数据和 Service

~~~text
□ Header 和 Footer 可以独立创建
□ zh-CN 和 en-US 可以创建不同 Variant
□ 同一位置同一 Locale 不允许重复 Variant
□ 支持 Page/Post/Category/Custom Link
□ Entity 引用不会保存最终 URL
□ Custom Link 禁止 javascript/data/vbscript
□ 最大层级生效
□ 循环父子关系被拒绝
□ 非法 Entity 被拒绝
□ 缺失 Translation 被正确标记
□ 保存树结构是事务性的
□ 删除菜单项不删除目标内容
~~~

### 14.2 后台 E2E

~~~text
□ 进入 Appearance/Navigation
□ 选择 Header + zh-CN
□ 添加页面、自定义链接、分类目录、文章
□ 拖拽排序和嵌套
□ 编辑 Label、打开方式和 rel
□ 隐藏和删除菜单项
□ 保存刷新后结构保持
□ 切换 en-US 后看到独立菜单
□ 从 zh-CN 复制菜单到 en-US
□ 未保存离开出现确认
~~~

### 14.3 前台 E2E

~~~text
□ zh-CN 页面显示中文 Header/Footer
□ en-US 页面显示英文 Header/Footer
□ 切换语言后导航同步切换
□ Entity Link 指向当前 Locale
□ 缺 Translation 的目标被隐藏
□ Custom Link 在当前 Locale 显示正确 URL
□ 新窗口链接包含安全 rel
□ SSR 首次加载有导航
□ 菜单缓存命中
□ 保存菜单后缓存失效
~~~

### 14.4 权限 E2E

~~~text
□ 无权限用户看不到 Navigation 入口
□ 直接访问后台 API 返回 403
□ navigation.view 只能读取
□ navigation.edit 可以保存树
□ navigation.delete 可以删除 Variant
□ 前端隐藏不是唯一权限防线
~~~

## 15. Phase 建议

本模块属于 P06 Navigation，拆分为：

### P06.1 Navigation Data Model

Migration、四张表、Repository、Resolver、URL 安全校验和 Unit Tests。

### P06.2 Admin Visual Menu Builder

NuxtAdmin Navigation Resource、左侧 Item Picker、右侧 Tree Editor、拖拽排序/层级、保存/错误和 RBAC。

### P06.3 Public Header/Footer

SiteHeader、SiteFooter、NavigationMenu、SSR、Locale Switch、Cache 和 SEO 联动。

## 16. 交给其他 AI 的开发指令

~~~text
你正在一个 Nuxt 4 + Nitro + Vue 3.5 + TypeScript + NuxtAdmin + MySQL 博客框架中开发 Navigation 模块。

请先阅读主架构文档、NuxtAdmin docs/开发指南.md、当前 Resource/Module/权限/事件/缓存实现，以及本 Navigation 模块规格。

必须实现：
1. Header/Footer 独立菜单位置
2. 每个位置支持多个 Locale Variant
3. Page、Post、Category、Custom Link 四种菜单项
4. 可视化左侧添加、右侧树形拖拽排序和嵌套
5. Entity Link 只保存 Entity 引用，不保存最终 URL
6. 当前 Locale 动态解析标题和 URL
7. 缺 Translation/未发布目标自动隐藏并在后台显示警告
8. zh-CN、en-US 和未来 Locale 的导航切换
9. NuxtAdmin RBAC 前后端双层执行
10. 保存事务、缓存和事件失效
11. Header/Footer SSR 输出
12. 单元测试、集成测试和 Playwright E2E

禁止：
1. title_zh/title_en 或 label_zh/label_en 字段
2. 把正式菜单存成不可查询的 JSON items
3. 把 Page/Post/Category 的最终 URL 写死在数据库
4. 在前端单独执行权限
5. 用中文菜单无提示地替代缺失英文菜单
6. 修改 NuxtAdmin Core 来临时满足一个博客业务需求
7. 让 Analytics 成为 Navigation 的硬依赖

交付：
1. Migration
2. Repository
3. Navigation Service
4. Locale-aware Resolver
5. Admin Visual Menu Builder
6. Public Header/Footer Components
7. API 和权限
8. Cache Invalidation
9. 测试结果
10. 已知问题和后续 Enhancement
~~~

## 17. 完成标准

~~~text
Phase Status: COMPLETE
Acceptance: PASS
Known Issues: NONE
Breaking Changes Allowed: NO
Follow-up: NONE
~~~

只有以下条件全部满足，Navigation Phase 才能标记 COMPLETE：

- Header/Footer 已独立管理
- 至少 zh-CN 菜单完整可用
- Page/Post/Category/Custom Link 全部支持
- 菜单可以排序和嵌套
- Locale Variant 数据模型完成
- 前台语言切换有效
- SSR 首屏有导航
- Entity URL 随当前 Locale 动态解析
- 缺失 Translation 行为明确
- RBAC 服务端验证通过
- 缓存和缓存失效测试通过
- Lint、Typecheck、Unit、Build、E2E 全部通过

