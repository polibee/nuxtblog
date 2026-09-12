# P08 Dashboard

## 1. 基本信息

~~~text
Phase ID: P08
Phase Name: Dashboard
Owner: polibee
NuxtAdmin Base Commit: a48695f
Depends On: P04, P05, P07
Target Version: v0.2.0-p08
Status: COMPLETE
~~~

## 2. 实现范围

- **WidgetStats** 重写：真实数据统计卡片（用户总数/活跃、文章已发布+草稿、评论已通过+待审核、页面已发布）——全部来自 MySQL 实时计数。
- **WidgetRecentPosts** 新增：最近 5 篇文章（标题链接到编辑页、状态、评论数），数据由 `listRecentPosts` 联合 primary locale 标题 + approved 评论子查询。
- **删除** WidgetRevenueChart / WidgetRecentOrders（演示 Orders 数据）。
- **CacheMonitor** 保留。
- **stats.get.ts** 重写：从 `getCollection('orders')` 等 demo 集合改为全量 Drizzle 实时查询（countPostsByStatus / listRecentPosts / countPendingComments / countApprovedComments / countPagesByStatus / countUsers），移除 OrderRow/getCollection 引用。

### 非目标

- 不做 Analytics 图表（P09）；不做拖拽 Widget 自定义布局；不做导出。

## 3. 新增 Repository 方法

~~~text
post.repository:   countPostsByStatus(status), listRecentPosts(limit) → RecentPost[]
comment.repository: countPendingComments(), countApprovedComments()
page.repository:   countPagesByStatus(status)
~~~

## 4. 验证结果

~~~text
npm run lint      → PASS
npm run typecheck → PASS
npm test          → PASS（124 tests / 18 files）
npm run build     → PASS
~~~

## 5. 完成记录

~~~text
Phase Status: COMPLETE
Acceptance: PASS
Known Issues: Dashboard 数据未经缓存（实时查询，数据量增长后可加 30s TTL）
Follow-up: P09 Analytics（Dashboard 可增加流量趋势 Widget）
~~~
