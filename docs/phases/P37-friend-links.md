# P37 Friend Links / Blogroll（友链.txt P0）

## 1. 基本信息

~~~text
Phase ID: P37
Phase Name: Friend Links / Blogroll Module
Owner: polibee
NuxtAdmin Base Commit: a48695f
Depends On: P02（Page 模板）、P14（Backup specs）、P34（Settings Registry）
Target Version: v0.2.0-p37
Status: COMPLETE
设计依据：docs/友链.txt 全文（§91 P0 清单 + §95 冻结原则）
~~~

## 2. 实现范围（摘要）

- **数据层（0033）**：friend_link_categories + category_translations（§66/8）、friend_links（status=active/disabled/broken/removed，normalized_url+domain、反链四字段+失败计数、nofollow/open_in_new_tab、source、submission_id，§9/10）、friend_link_submissions（独立分表 §11，pending→reviewing→approved/rejected/spam §13，站点检测 site_status/http/title + 反链检测字段 + submit_ip_hash/user_agent §12）+ friend_link_checks 历史表（§81，未入备份 §85）
- **url-normalizer**（§23/46）：scheme://host/ 规范化、hostname 真比较（www 等价、example.com.evil.com 不等价）
- **checker.ts**（§18-36，SSRF 防护为第一约束）：http(s) 白名单；私网/环回/链路本地 IPv4+IPv6 拒绝；**DNS 解析后逐 IP 复检**（防 rebinding §30）；手动 redirect 链 ≤5 跳、每跳重新校验（§31）；8s 超时 + 2MB 响应上限（§32）；UA=NuxtBlog-LinkChecker/1.0（§33）；反链判定解析真实 `<a href>` 的 hostname（§22），提取 anchor 与 rel（§25/26）；策略 backlink_url→首页→/friends /links /link /blogroll 有限探测（§21）；site-check 返回 online/unreachable/timeout/error + HTTP + title + 延迟（§35/36）
- **服务**：submission.service——Honeypot（§47）+ 每 IP 24h 5 次限频 + domain 重复检测（active 友链 409 / 在审 409，§45/46）+ 服务端重跑双检测（§74 不信任客户端）；approve 事务内「编辑后建链」+ submission.status=approved（§43/44）；friend-link CRUD（软删）；checkFriendLinkNow（Check Now §40）；runScheduledChecks——active 友链并发 5（§53），not_found 累计失败计数、found 清零，**绝不自动下架**（§54-56）
- **API**：公开 POST /api/friend-links/submissions、POST check-backlink（20/h per-IP）；后台 GET/POST /api/admin/friend-links、PUT/DELETE :id、POST :id/check、GET submissions、POST submissions/:id/approve|reject（friend-links.view/edit 权限，editor 可用）
- **设置**（P34 Registry，§62/63）：friend_links.enabled / submissions_enabled / backlink_policy(none|recommended|required) / auto_check_backlink / auto_hide_broken / default_nofollow / open_external_new_tab——growth 组
- **定时**：scheduler 挂 24h 友链健康巡检（§51-52）
- **前台**（§4/5/71/72）：Page 模板 friend_links（编辑器可选）；专属静态路由 /friends（public-full 全宽，§71）——page 标题/简介来自 Page 实体，Grid（featured 分组 + 分类筛选 + Favicon 回退 §7）+ 本站信息复制（§17）+ 底部申请表单与顶部锚点（§72）+ 提交后检测反馈（§73）
- **后台**（§38-43）：FriendLinksManagerPage 双 Tab——友链列表（状态筛选/反链徽标/失败次数/最近检查/Check Now/编辑/停用/删除）+ 申请审核（待审徽标计数、自动检测摘要、审核对话框：批准前可编辑名称/URL/简介/Logo/featured/nofollow，Approve/Reject/Spam）
- **Backup**（§85）：friend-link-categories/-translations/submissions/links 入 specs（FK 重映射按序），checks 排除；缓存 friend-links 内存 30min（§87），管理端变更立即失效
- **菜单自动发现**（用户需求）：菜单选择器新增页面/分类/文章在切 Tab、窗口聚焦（5s 节流）、posts:refresh 事件时自动重载，无需重开菜单编辑器

## 3. 验证结果

~~~text
npm run lint      → PASS（0 errors；既有 v-html 警告 1 条可接受）
npm run typecheck → PASS
npm test          → PASS（167 tests / 21 files）
npm run build     → PASS
真实环境 E2E     → PASS
~~~

## 4. E2E 验证

- 创建 friends 页（template=friend_links）→ /friends SSR 全宽渲染 Grid+表单+本站信息 ✓
- 提交：正常站点 online/not_found 入 pending ✓；127.0.0.1 提交 → unreachable（SSRF 防护拦截私网 ✓）；Honeypot 400 ✓；同 domain 重复 409 ✓；同 IP 第 6 次 429（限频）✓
- 审核批准（编辑名称/简介/featured）→ 事务建链 → 公开端点立即出现（缓存失效 ✓）
- 后台导航出现「友情链接」（内容组）+ 设置页出现「友情链接」策略组 ✓
- Check Now / 定时巡检逻辑就绪（真实反链检测需对外可达环境验证）

## 5. 完成记录

~~~text
Phase Status: COMPLETE（P0 全项）
Acceptance: PASS
Known Issues: 反链策略 required 的批准前强制拦截未硬闸（管理员责任兜底，§63 recommended 语义）；分类管理 UI 暂缺（表+种子已备）；友链邮件通知/Turnstile/JS 渲染检测/申请状态查询为 P1（§92）；自动 favicon 获取 P1（§92）
Follow-up: Audit Log 接入（§84，项目尚无通用 audit 工具）；Dashboard 友链健康卡片（§57）；friend_link_checks 保留 90 天清理 job
~~~
