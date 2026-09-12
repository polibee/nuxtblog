# P14b Full Site Backup（ZIP + Manifest + Provider Registry + Restore 引擎 + 灾难演练）

## 1. 基本信息

~~~text
Phase ID: P14b（路线图 P14 Tools/Backup 剩余部分）
Phase Name: 完整站点备份与恢复
Owner: polibee
NuxtAdmin Base Commit: a48695f
Depends On: 全部内容模块（P00~P24）
Target Version: v0.2.0-p14b
Status: COMPLETE
设计依据：docs/新建 文本文档.txt（P14 章节，§2-25）
~~~

## 2. 实现范围（摘要）

- **迁移 0027**：backup_jobs（job 历史：状态/文件/大小/版本/创建人）
- **Provider Registry**（§8）：TABLE_SPECS 表驱动——44 个聚合键（locales/users/media+translations+variants/settings+localized/categories+tags+translations/posts+translations+post_categories+post_tags/pages+translations/navigations+variants+items+translations/sidebar-cards+translations/comments/products+prices+inventory/membership-plans+translations/subscriptions/post-purchases/ad-* 6 表/slider-* 3 表），每表声明 FK 重映射 / 自引用 / 日期列
- **导出**（§5/6/19）：AdmZip 归档——manifest.json（format/version/createdAt/database/defaultLocale/locales/modules/includesMedia/counts）+ data/*.json（43 个聚合）+ media/*（原图与变体二进制）；secret 型设置值 REDACTED（§18）；排除 orders/交易/支付凭据/analytics/sessions/tokens（§17）；url-redirects 排除（多态 entityId 无法通用映射，可再生）
- **Restore 引擎**（§10-16）：preview（manifest 校验 + 各模块行数 + 版本差异提示）→ Replace 模式——逆序清空被备份表 → 单事务内按依赖序重插，全表 ID 映射（context mapId）、自引用增量映射、孤儿引用行跳过、ISO 日期串自动还原 Date → 提交后写媒体文件；确认词 RESTORE（§21）
- **Admin API**：POST /api/admin/backup（创建+入库存+记 job）、GET /（历史）、GET /:id/download、POST /preview、POST /restore（confirm 强制）
- **后台**（§20/21）：app/modules/backup → 系统 → 备份与恢复管理页——创建（自动下载）、历史表、恢复上传 → 预览（版本/语言/各模块计数/校验问题）→ 输入 RESTORE → 执行
- 依赖：adm-zip（+@types）

## 3. 验证结果

~~~text
npm run lint      → PASS（0 errors；既有 v-html 警告 1 条可接受）
npm run typecheck → PASS
npm test          → PASS（167 tests / 21 files）
npm run build     → PASS
灾难演练（§25）   → PASS
~~~

## 4. 灾难演练记录（真实 MySQL）

- 创建备份：job #1，24.8KB ZIP，71 项（43 数据文件 + 26 媒体文件 + manifest）
- 新建空库 nuxtblog_drill（Laragon mysql CLI）→ 生产构建以 BLOG_DB_NAME=nuxtblog_drill 启动 3001 端口 → 自动迁移 + 种子
- 空库确认（posts=0）→ 上传备份 → preview valid → RESTORE → **106 行写入**（posts 1 / translations 2 / media 8 / variants 18 / campaigns / sliders / products 5…）
- 恢复后验证：公开文章列表返回原文章、媒体文件 /media/{key} 200、会员计划 1 个、以备份中的密码哈希重新登录成功
- 演练环境已清理（drop 库、停实例）

## 5. 完成记录

~~~text
Phase Status: COMPLETE（P14 验收标准 §117 达成：Create Backup → Restore to Fresh DB → Site runs correctly）
Known Issues: 同步执行（大站点需 JobQueue，接口已 job-friendly）；Merge 模式未做；正文内嵌媒体引用依赖存储 key 一致性
Follow-up: Merge 恢复模式、备份定时任务、S3/R2 存储适配器、恢复演练自动化
~~~
