# P38 通知中心（Event Delivery / Notification Center）

## 1. 基本信息

~~~text
Phase ID: P38
Phase Name: Notification Center（Event Registry + Outbox + Channels）
Owner: polibee
NuxtAdmin Base Commit: a48695f
Depends On: P14（webhook SSRF 工具/加密）、P34（Settings Registry）
Target Version: v0.2.0-p38
Status: COMPLETE
设计依据：docs/webhook.txt 全文（N1-N5 阶段 + §81 验收清单）+ docs/spug20260810.txt（Spug Push 接口）
~~~

## 2. 实现范围（摘要）

- **迁移 0034**：notification_channels（config AES-GCM 整体加密，读取仅回掩码 hint §44/59）、notification_subscriptions + notification_subscription_events（关系表 §61）、event_outbox（dedupe_key + suppressed_count §50、status pending/processing/processed/failed §45）、notification_deliveries（per-subscription 投递记录 + attempt_count/next_retry_at/last_error §46）
- **Event Registry**（代码注册 §63-65，DB 只存 event_name）：27 个可通知事件按 8 模块分组（content/comments/store/membership/security/ai/backup/system），resource.action 命名 + info/warning/error/critical 严重级别；`mapCmsEvent` 把既有 CMS 总线事件（content.published 等）映射为注册事件
- **Outbox + Worker**（§44/73）：emitCmsEvent 尾部挂 enqueueFromCmsEvent（best-effort，业务永不被通知失败拖垮 §44）；scheduler 15s tick 排水——claim outbox → 匹配订阅（事件 + 最低严重级别 §23）→ 建 delivery → 立即投递 → 重试到期投递
- **重试**（§47/48）：仅 429/5xx/网络错误/超时可重试；延迟 1m/5m/30m/120m，5 次后 dead；400/401/403 直接失败
- **Dedup**（§50/51）：error/critical 事件 dedupe_key=`{name}:{entityId}`，5 分钟窗口抑制重复并累加 suppressed_count
- **Channel Adapters**（§6）：webhook（复用既有 SSRF 防护 resolveSafeWebhookUrl + HMAC signPayload，payload 带 version/id/event/timestamp §34/35）、lark（text 或 interactive card，签名可选 §8）、spug（POST push URL（凭证在路径内 /send/<CODE> 或 /xsend/<TOKEN>），{title, content}，§9 + spug 文档）
- **API**（§66-69）：channels GET/POST/PATCH/DELETE（有投递历史时改为停用并 409）+ POST :id/test；events GET（搜索）；subscriptions GET/POST/PATCH（事件全量替换）/DELETE；deliveries GET（status 筛选）+ POST :id/retry
- **后台 UI**（§76/82）：NotificationsManagerPage 三 Tab——渠道卡片（provider 徽章/掩码 URL/Test/启停/删除）、订阅列表（事件 chips/最低级别）+ 编辑对话框（**EventPicker**：模块分组 + 搜索 + 最低严重级别选择）、投递日志（状态筛选/手动重试）
- **Settings**（§57）：notifications.enabled、notifications.allow_private_network（默认关）注册进 Settings Registry（system 组，module=notifications 模块禁用自动隐藏）
- **权限**：notifications.view/edit（editor 可用）
- **菜单自动发现补充**：NavigationItemPicker 现在在切 Tab/窗口聚焦（5s 节流）/posts:refresh 事件时自动重载，新建页面/分类无需重开菜单编辑器（用户同批需求）

## 3. 验证结果

~~~text
npm run lint      → PASS（0 errors；既有 v-html 警告 1 条可接受）
npm run typecheck → PASS
npm test          → PASS（167 tests / 21 files）
npm run build     → PASS
真实环境 E2E     → PASS（全链路）
~~~

## 4. E2E 验证

- 事件目录：GET events 返回 27 事件 / 8 模块，搜索可用 ✓
- 全链路：创建 webhook 渠道（httpbin.org）→ 订阅 post.published → 发布 probe 文章（post.service 补发了 content.published）→ worker 15s tick 排水 → delivery status=success, HTTP 200 ✓
- 清理：订阅/渠道删除 ✓（渠道有投递历史 → 409 并自动停用，符合"保留审计"设计）；probe 文章已删
- 曾出现 post.service 无事件发射的缺口——已补齐 create/update/delete 三处发射（published/unpublished/updated/deleted 转换）

## 5. 完成记录

~~~text
Phase Status: COMPLETE（N1-N5；N6 模板编辑器按文档可后置）
Acceptance: PASS（§81 验收清单除"事件矩阵 Overview"可选项）
Known Issues: Lark 签名用简单 timestamp 拼接（飞书官方算法如需严格验签再补）；模板系统（N6）未做——渲染用内置默认格式；Spug 语音/短信专属字段未暴露（按文档交给 Spug 侧管理）
Follow-up: N6 模板系统、聚合通知（10 分钟 N 条评论）、Telegram/Discord/Email 适配器、老 webhook_targets 演示数据迁移
~~~
