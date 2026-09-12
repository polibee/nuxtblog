# P24 商品详情页排版优化

## 1. 基本信息

~~~text
Phase ID: P24
Phase Name: 商品详情页紧凑购买详情改造（依据 docs/商品页优化.txt）
Owner: polibee
NuxtAdmin Base Commit: a48695f
Depends On: P13c/P13e（商店详情）、P23（列表 ProductCard）
Target Version: v0.2.0-p24
Status: COMPLETE
~~~

## 2. 实现范围（摘要）

- **55/45 双栏**：grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]，gap 40px（§4/103）
- **Gallery**：4:3 + max-h-[520px]、rounded-xl bg-muted；主图 eager + fetchpriority=high（LCP，§68）；点击打开 Lightbox（90vw/90vh object-contain，§11）
- **右栏信息顺序**（§12）：类型（数字/实体商品 muted 文本）→ 标题 28-32px（text-3xl semibold）→ 简介三行 → 价格 3xl bold（免费绿字）→ 分隔线 → 数量步进器（仅 maxQuantityPerOrder>1，数字商品隐藏 §26）→ 立即购买 h-12 全宽（加载/售罄禁用态 §78/91）→ 合计 → Product Facts（bg-muted：类型/交付/库存，不暴露存储路径 §44/77）→ Trust（仅真实能力：安全支付/即时交付 §32）
- **正文**：max-w-[820px] 居中 + 1.75 行高（§37/38/46）
- **相关商品**：复用 ProductCard，桌面 4 列 / 移动 2 列，取最新 4 个排除自身，客户端懒加载（§48/98；无分类数据，同分类算法留待分类上线）
- **移动 Sticky Purchase Bar**：价格 + 立即购买，滚动 >600px 才出现（§59），safe-area-inset-bottom（§62），lg:hidden
- **SSR**：详情 useFetch 去 lazy——主图/价格/购买按钮首屏 SSR 输出（§35 验收）
- 公开商店详情页不显示博客侧边栏（P23 已切 public-full，§47）

## 3. 验证结果

~~~text
npm run lint      → PASS（0 errors；既有 v-html 警告 1 条可接受）
npm run typecheck → PASS
npm test          → PASS（167 tests / 21 files）
npm run build     → PASS
真实环境 E2E      → PASS
~~~

## 4. E2E 验证（dev server + curl HTML 结构化）

- /store/{alias} SSR：55/45 grid、max-h-[520px]、fetchpriority="high"、text-3xl 标题、max-w-[820px] 正文、Product Facts（类型/交付/库存）、安全支付 trust
- 售罄商品按钮渲染为 disabled + 已售罄（§78 正确行为）
- 移动 Sticky Bar（lg:hidden）与 Lightbox 结构在 HTML 中

## 5. 完成记录

~~~text
Phase Status: COMPLETE
Acceptance: PASS（四道闸门 + SSR 结构化验证；移动端真机/Safe Area 留待用户走查）
Known Issues: 单图商品无缩略图（当前数据模型单图，多图需 schema 扩展）；无会员价/原价数据（分层展示结构已备）
Follow-up: 多图 Gallery + 缩略图、会员价分层、Product Structured Data（需真实 SKU 数据）、分类相关推荐
~~~
