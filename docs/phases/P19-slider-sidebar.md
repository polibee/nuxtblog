# P19 Slider 模块 + 侧边栏卡片化 + 特色图条件显示

## 1. 基本信息

~~~text
Phase ID: P19
Phase Name: 轮播图模块（slider.txt 全规格）+ 前端修正
Owner: polibee
NuxtAdmin Base Commit: a48695f
Depends On: P03（Media）、P04（Posts）、P16（侧边栏卡片）、P18（公开前端）
Target Version: v0.2.0-p19
Status: COMPLETE
设计依据：docs/slider.txt（67 节 Slider/Carousel Module 设计）
~~~

## 2. 实现范围（摘要）

### P19.1 特色图条件显示 + 侧边栏卡片化

- 文章列表/卡片视图：无特色图时不渲染任何占位图（按用户要求）
- 侧边栏新增两种卡片类型：`article_toc`（文章目录，正文 h2/h3 ≥3 时渲染，其他页面自动隐藏）与 `ad_slot`（广告位，content 存 slot key，原样输出不走 sanitize）
- public layout 移除硬编码的 TOC 与 AdSlot——侧边栏现在 100% 由后台侧边栏卡片驱动（顺序/启停/删除全可管理）
- boot seed 幂等补种 article_toc（sort 0）+ ad_slot（sort 90，content='sidebar-ad'）

### P19.2 Slider 数据层

- 迁移 0023（sliders UNIQUE(key) / slider_items / slider_item_translations UNIQUE(item,locale)），drizzle-kit generate 后手工裁剪掉历史快照噪音语句（DROP slug/FK 等，避免真实 DB 执行失败）
- slider.repository：sliders/items/translations CRUD + 事务化 replaceTranslations + reorder
- slider.service：admin CRUD（key 冲突 409、写后失效 KV 缓存）、公开 resolvePublicSlider（enabled + starts_at/ends_at 时间窗过滤、请求 locale 翻译 → 默认 locale 回退、image URL 解析）、运行时状态计算（active/scheduled/expired/disabled，无 status 字段）
- 缓存：KV `slider:{key}:{locale}` TTL 600s（含 locale，符合 §52）；任何 admin 写失效该 key 全语言
- boot seed：home.hero（enabled=false，无预置 slide）

### P19.3 公开 API + SiteSlider

- GET /api/public/sliders/:key?locale= → { key, config, items[] }（前端不处理 enabled/时间窗/locale 回退，§49-50）
- SiteSlider.vue（app/modules/slider/components/）：桌面 16:7 / 移动 4:3（全部 slide 有移动图时才切 4:3 容器，否则恒 16:7，杜绝跳动）、object-cover（禁 contain）、max-height 620px、容器先有比例无 CLS
- 行为：autoplay+interval、pause_on_hover、visibilitychange 暂停、prefers-reduced-motion 关动画/停自动播、slide/fade 双 transition、单张自动静态（无箭头/圆点/自动播）、空态不渲染不占高
- 链接：整张可点；站内 NuxtLink、站外 `<a target=_blank rel="noopener noreferrer">`；无 URL 不可点（无 href="#"）；write 侧 zod 校验仅 `/` 与 http(s)
- LCP：第一张 eager + fetchpriority=high，其余 lazy；键盘 ←/→、触摸滑动
- 接入：public layout 在 route.name==='index' 时渲染 `<SiteSlider slider-key="home.hero" />`，占满 Main+Sidebar 整宽（§55）

### P19.4 后台管理页

- /admin/sliders（SliderResource pages.list → SliderManagerPage，权限 sliders.view/edit）
- 轮播设置：启用/自动播放/间隔 ms/切换动画/箭头/圆点/悬停暂停；新建轮播（key+name）、删除轮播（含级联 items）
- Slides 列表：原生 HTML5 拖拽排序（drop 即 POST reorder 持久化）+ ↑↓ 键盘替代；运行时状态徽标（展示中/待展示/已过期/已停用）；16:7 缩略图
- Slide 编辑对话框：桌面/移动图 MediaPickerField + 固定比例裁切预览（16:7 / 4:3 与前台一致，§20/46）+ 尺寸提示文案（§27）；多语言文案（locale 下拉：标题≤80/描述≤160/按钮≤30/Alt + locale URL override）；链接 URL + 打开方式（self/blank）；起止时间（datetime-local）；单项启停

## 3. 验证结果

~~~text
npm run lint      → PASS（0 errors；既有 v-html 警告 1 条可接受）
npm run typecheck → PASS
npm test          → PASS（167 tests / 21 files）
npm run build     → PASS
真实 MySQL E2E    → PASS（见下）
~~~

## 4. 真实环境 E2E（Laragon MySQL 8.0.30 + dev server）

- 迁移 0023 应用（3 表 + 索引）；boot seed home.hero（disabled）+ 侧边栏 article_toc/ad_slot 卡片
- 管理员登录 → PUT sliders/1 enabled → POST items（media #3 + zh-CN 文案）→ GET /api/public/sliders/home.hero 返回 config+items（翻译/media URL/链接齐全）→ 写后缓存失效验证（再次 resolve 立即反映变更）
- 首页 SSR HTML：aria-roledescription="carousel"、aspect-[16/7]、fetchpriority="high"、slide 文案注入
- /api/public/sidebar 返回 article_toc + ad_slot（content='sidebar-ad' 原样）+ 既有卡片
- 测试后：轮播名恢复（UTF-8 body），slider 停用（首页无轮播、无空占高），测试 slide 保留供后台查看
- 已知测试坑：curl 内联中文 JSON 会 cp1252 乱码——UTF-8 文件 + --data-binary；items 端点相对导入需 5 层（[id] 目录）

## 5. 完成记录

~~~text
Phase Status: COMPLETE
Acceptance: PASS（四道闸门 + 真实环境端到端；slider.txt 验收清单除 Media Variant 项外全部满足）
Known Issues: Media slider_desktop/slider_mobile 派生 variant 未做（object-cover CSS 裁切等效，原图天然保留）；首页 slider 由 layout 按 index 路由挂载（非页面内 Teleport，布局两层结构决定）
Follow-up: Nuxt Image/AVIF 压缩、分类页/专题页 slider 位置扩展、slider 预览后台 iframe 化
~~~
