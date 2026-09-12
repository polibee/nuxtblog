# P23 商城列表排版 + Slider 左栏化优化

## 1. 基本信息

~~~text
Phase ID: P23
Phase Name: Store UI 排版优化 + Slider 左栏化（依据 docs/商城优化.txt 与 docs/slider优化.txt）
Owner: polibee
NuxtAdmin Base Commit: a48695f
Depends On: P13c（商店前端）、P19（Slider 模块）
Target Version: v0.2.0-p23
Status: COMPLETE
~~~

## 2. 实现范围（摘要）

### Slider 左栏化（slider优化.txt 最终冻结规则）

- SiteSlider 从 public layout 通栏位（1280 全宽）移入首页 Main Column 顶部（左栏内，与 Sidebar 顶部对齐，Rule 1/2/3）
- 桌面比例 16:7 → **3:1**，max-height 620px → **320px**；移动端恒 4:3（Rule 4/6/7）
- 后台提示同步：桌面推荐 1500×500（3:1）、预览比例 aspect-[3/1]（Rule 9）
- 关闭后不保留空白占位（Rule 10，原行为即如此）

### 商城列表排版（商城优化.txt 验收清单）

- 新布局 layouts/public-full.vue（Header/Footer + 1280 全宽、无 Sidebar，§80）；商店列表与详情页均切换（§81 详情保持 60/40 双栏）
- ProductCard（app/components/store/）：4:3 图（PublicProductImage，placeholder 保持比例）、标题 16px 两行 min-h、描述 14px 两行（<640px 隐藏）、价格 18~20px semibold + margin-top:auto 底对齐（§62）、无大 CTA（查看详情→ 文字）、免费商品显示"免费"、售罄 = 图片遮罩 + Badge（标题价格仍清晰，§58）、hover 轻上移 + 图 scale 1.03（§34/35）、rounded-xl shadow-sm→hover:shadow-md
- 响应式冻结（§76）：grid-cols-2 gap-3（<640）→ sm:gap-5 → lg:grid-cols-3 → xl:grid-cols-4 gap-6（1280 容器）
- 每页 16（4×4，§74）+ 经典分页（复用 PublicPagination）
- 搜索（max-w-320 右侧）+ 排序（最新/价格低→高/价格高→低，客户端排序）
- Skeleton 占位与真实卡片同比例（§71）；整卡 NuxtLink 真链接（§84）

## 3. 验证结果

~~~text
npm run lint      → PASS（0 errors；既有 v-html 警告 1 条可接受）
npm run typecheck → PASS
npm test          → PASS（167 tests / 21 files）
npm run build     → PASS
真实环境 E2E      → PASS
~~~

## 4. E2E 验证（dev server + curl HTML 结构化）

- /store：无 sidebar（lg:w-80 = 0 处）、grid-cols-2/lg:grid-cols-3/xl:grid-cols-4 响应式、"查看详情 →"文字链
- 首页：carousel 渲染 + aspect-[4/3] md:aspect-[3/1] + max-height:320px；侧边栏（sidebar-ad 卡片）保持
- Slider 关闭时无空槽（既有行为）

## 5. 完成记录

~~~text
Phase Status: COMPLETE
Acceptance: PASS（四道闸门 + 结构化验证；浏览器像素级走查留待用户）
Known Issues: 商品无 category 数据（卡片分类行留空）；排序/搜索为客户端实现（数据量小可接受）；NuxtImg/product_card 变体未接（媒体变体已备 thumbnail/medium）
Follow-up: 分类筛选 Tabs（需商品分类数据）、featured badge、售罄库存联动
~~~
