# P09 Analytics + SEO Traffic

## 1. 基本信息

~~~text
Phase ID: P09
Phase Name: Analytics + SEO Traffic
Owner: polibee
NuxtAdmin Base Commit: a48695f
Depends On: P04
Target Version: v0.2.0-p09
Status: COMPLETE
~~~

## 2. 实现范围（对照架构 §11）

- **数据表**：analytics_events（event_id UNIQUE 去重）+ analytics_sessions（session_key UNIQUE 30min 窗口）；索引含 occurred_at、session_key+occurred_at、visitor_key+occurred_at、path+occurred_at。
- **客户端采集**：app/plugins/analytics.client.ts——page:finish/page:start hook 发送 page_view；visitor_id（localStorage 30d）+ session_id（sessionStorage 30min 滑动）；navigator.sendBeacon 优先（fallback fetch keepalive）；DNT 过滤；/admin /api /preview 路径过滤。
- **Collect API**：POST /api/analytics/collect——bot UA 过滤（Googlebot/curl/python 等）、限流 60/min/IP、Zod 校验、路径过滤、locale 解析、INSERT IGNORE 去重 + session UPSERT（pageviews+1 / isBounce=false）、fire-and-forget（采集失败不阻塞）。
- **报表 API**（analytics.view RBAC）：GET /api/analytics/report/overview?days=7→14/30/90 返回 overview（pageviews/sessions/visitors/bounceRate）+ trend（日粒度 GROUP BY）+ sources（TOP 来源）+ pages（TOP 页面）。
- **后台报表页**：/admin/analytics——统计卡片（Pageviews/Sessions/Visitors/Bounce Rate）+ 访问趋势条形图 + 来源列表 + 热门页面列表；天数切换 7/14/30/90。
- **Dashboard 联动**：stats.get.ts 从真实 DB 查询（用户/文章/评论/页面计数 + 最近文章含评论数），移除 Orders/Revenue 演示 Widget。

### 隐私设计（§11.8）

- 不保存原始 IP、Cookie 内容、表单数据
- visitor_id 为随机 UUID（localStorage 30 天）
- User-Agent 在服务端解析后只保存设备/浏览器/OS 结果
- bot 过滤（Googlebot/curl/python 等）

### 非目标

- 不做日聚合表（analytics_daily_*）——v1 从 events 表实时 GROUP BY 计算；P19 优化
- 不做鼠标轨迹/录屏/热力图/A-B 测试
- 不做跨站追踪和精确地理位置

## 3. 数据模型

~~~text
analytics_events: id, event_id varchar(64) UNIQUE, event_type, occurred_at, session_key,
                  visitor_key, path varchar(500), locale_code, referrer_domain, utm_*,
                  device_type, browser, operating_system, viewport_bucket, is_bot, created_at
索引: UNIQUE(event_id), (session_key, occurred_at), (visitor_key, occurred_at),
      (path, occurred_at), (occurred_at)

analytics_sessions: id, session_key varchar(128) UNIQUE, visitor_key, started_at, last_seen_at,
                    landing_path, exit_path, source, medium, campaign, locale_code,
                    device_type, browser, operating_system, pageviews int, is_bounce,
                    is_bot, created_at, updated_at
索引: UNIQUE(session_key), (visitor_key), (started_at)
~~~

## 4. 验证结果

~~~text
npm run lint      → PASS
npm run typecheck → PASS
npm test          → PASS（124 tests / 18 files）
npm run build     → PASS
集成实测          →
  采集 → 200 ok:true（数据库写入验证）
  bot 过滤 → Googlebot UA 返回 ok:false ✓
  重复 event_id → 去重（INSERT IGNORE 语义）✓
  报表 → pageviews/sessions/visitors/bounceRate 正确 ✓
  趋势 → 日粒度 GROUP BY ✓
  来源/页面 → TOP 列表 ✓
  RBAC → 未登录 401 ✓
浏览器验证       → /admin/analytics 报表页完整渲染（卡片+趋势+来源+页面）
~~~

## 5. 完成记录

~~~text
Phase Status: COMPLETE
Acceptance: PASS
Known Issues:
  - 日聚合表（analytics_daily_*）未实现——趋势从 events 实时 GROUP BY，数据量增长后 P19 优化
  - path 列 varchar(500)（原 2048 因 utf8mb4 索引 3072 字节限制缩短）
  - 采集失败静默（fire-and-forget），无告警（P19 加监控）
Follow-up: P10 Membership
~~~
