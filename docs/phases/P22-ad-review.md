# P22 广告购买材料与审核 + 购买页启停

## 1. 基本信息

~~~text
Phase ID: P22
Phase Name: 广告主自助申请（材料提交）+ 合规审核流程 + 购买页管理启停
Owner: polibee
NuxtAdmin Base Commit: a48695f
Depends On: P21（广告购买）、P17（决策/投放）、P03（Media）
Target Version: v0.2.0-p22
Status: COMPLETE
~~~

## 2. 实现范围（摘要）

- **数据层（0026）**：ad_campaigns += material_title/description/image_media_id/url/slot_key + contact_email + review_note
- **公开申请页 /advertising**（受 ADVERTISING_PURCHASE_ENABLED 设置门控）：素材标题/描述、落地页 URL（仅 http(s)）、广告位选择（GET /api/public/advertising/slots）、预算、联系邮箱、图片上传（POST /api/public/advertising/upload → usage_type=advertising + 魔数白名单 + 10MB）；提交即建计划（draft）+ 预算订单（游客邮箱落单）→ 跳转结账
- **状态机**：draft →（支付成功）pending_review →（管理员通过）active → 自动创建 image 创意 + 翻译 + placement（priority 10）；驳回 → rejected + review_note
- **决策服务调整**：同槽位多投放由"priority 升序取第一个"改为 **priority 权重加权轮播**（weight=max(priority,0)+1），付费计划按权重公平分享流量
- **管理端**：CampaignsManagerPage 审核（通过/驳回+备注）+ 广告购买页启停开关（GET/PUT /api/admin/advertising/purchase-enabled）；createOrder 支持游客 email
- 页面模块本身已有 draft/published 状态启停（P05），未重复实现

## 3. 验证结果

~~~text
npm run lint      → PASS（0 errors；既有 v-html 警告 1 条可接受）
npm run typecheck → PASS
npm test          → PASS（167 tests / 21 files）
npm run build     → PASS
真实 MySQL E2E    → PASS
~~~

## 4. 真实环境 E2E

- 公开上传素材（media #10, usage=advertising）→ slots 列表 → apply → 计划 #3（draft，材料/邮箱/槽位落库）+ 订单 ORD-MTX05K6XAMJ9
- mock 网关支付 → 计划 pending_review（paid 8000）→ 管理员 approve → active + 自动创建 creative #2（campaign 3）+ placement（sidebar-ad, priority 10）
- resolve-batch 实际投放新创意；启停开关：false → apply 403 → 恢复 true
- 排障记录：resolve-batch 有 60s slot+locale 候选缓存，分布观测需换 key 或等 TTL

## 5. 完成记录

~~~text
Phase Status: COMPLETE
Acceptance: PASS（四道闸门 + 真实环境端到端）
Known Issues: 驳回不自动退款（人工处理）；申请图片无服务端尺寸校验（前端 16:7 预览提示）
Follow-up: 驳回自动退款、素材变更需重新审核、投放排期与频次
~~~
