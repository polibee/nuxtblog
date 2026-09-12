# P03 Media

## 1. 基本信息

~~~text
Phase ID: P03
Phase Name: Media
Owner: polibee
NuxtAdmin Base Commit: a48695f
Depends On: P00
Target Version: v0.1.0-p03
Status: COMPLETE
~~~

## 2. 目标与非目标

### 2.1 目标

- media + media_translations 真实 DB 化：基座媒体库 UI（列表/上传/预览/删除）全部切到 MySQL + useStorage('media')。
- 文件本体不随语言复制；alt/caption 进翻译表（架构 §9.2），通过行内「编辑信息」动作弹窗按 Locale 编辑（LocaliedField）。
- 公开媒体投递路由 GET /media/:key（key 为服务端生成的 timestamp-uuid，带路径穿越防护；immutable 缓存头）。
- 上传校验：multipart file 字段、10MB 上限（413）、空文件 422、存储键唯一；DB 写失败回滚存储字节（不留孤儿文件）。
- 修复 translations 键形态：所有返回记录统一按 locale code 为键（此前为 locale id，会导致编辑表单显示为空），sidebar 与 media 服务共用 server/utils/translations.ts。

### 2.2 非目标

- 不做图片处理（宽高探测、缩略图、WebP 转换）——width/height 列已预留。
- 不做远程/对象存储驱动（S3/OSS），P19 生产加固项。
- 不做媒体选择器组件（P04 Posts featured_image 时再建）。

## 3. NuxtAdmin 接入点

~~~text
Module: app/modules/media（MediaResource 增加「编辑信息」Action，其余复用）
Resource: media（permissionPrefix: media；endpoints.create 指向 /api/admin/media/upload 不变）
Server API: /api/admin/media 静态目录接管（index.get/[id].get/[id].put/[id].delete/upload.post/[id]/raw.get）
Server Route: GET /media/:key 公开文件投递
Server Service: server/modules/media/media.service.ts
Server Repository: media.repository.ts、schema/media.ts
Server Utils: translations.ts（translations 键 id→code 映射，sidebar/media 共用）
Permissions: media.view/create/edit/delete（演示 editor 映射已含 media.*）
~~~

## 4. 数据模型

### 4.1 Entity

~~~text
Table: media
Fields: id, storage_key varchar(120) UNIQUE, filename varchar(255), mime varchar(120),
        size bigint, width/height int nullable, created_at, updated_at
Indexes: UNIQUE(storage_key), INDEX(filename)
Delete strategy: 硬删除，存储字节同步清除（先取 key 后删行，删失败不留孤儿行）
~~~

### 4.2 Translation

~~~text
Table: media_translations
Entity FK: media_id CASCADE；Locale FK: locale_id CASCADE
Required fields: alt varchar(255) default '', caption varchar(500) default ''
Unique: UNIQUE(media_id, locale_id)
Public completeness rule: 无（alt/caption 可为空串，不参与发布判定）
~~~

### 4.4 Migration

~~~text
Migration: 0005_media_tables.sql
Rollback: DROP 两表（存储目录 .data/media 内文件需手工清理）
~~~

## 5. Repository 与 Service

- repository：分页/搜索（filename/mime LIKE）/排序；translations 按 media id 聚合；事务内替换翻译组。
- service：sanitizeMediaFilename（去路径分隔/控制字符/Windows 保留符，空名回退 'file'）；makeStorageKey；上传（存储→DB，失败反向 removeItem）；updateMediaItem（zod strict：filename 可选 + translations 整组替换，未知 locale 422）；deleteMediaItem；isSafeStorageKey（公开路由防穿越）。

## 6. Resource / Widget

MediaResource：图片列/文件名/类型/大小/上传时间 + 预览 Action（record.url 即公开 /media/key）+「编辑信息」Action（form: localizedInput(alt/caption)，ActionHost 以 record 回填，保存后 emitAdminEvent('media:refresh') 驱动列表刷新）。上传表单不变（fileInput multipart）。

## 7. Route 与 API

~~~text
POST /api/admin/media/upload      media.create  multipart field "file"；413/422
GET  /api/admin/media             media.view    q/page/perPage/sortBy → Paginated
GET  /api/admin/media/:id         media.view    含 code 键 translations
PUT  /api/admin/media/:id         media.edit    filename/translations
DELETE /api/admin/media/:id       media.delete  行+字节同删
GET  /api/admin/media/:id/raw     media.view    权限门控字节流（兼容保留）
GET  /media/:key                  公开          400 非法 key；404 不存在；immutable 缓存
~~~

Server 检查：显式 import ✓ / Handler 无 SQL ✓ / 经 Service ✓ / Server 权限 ✓ / 错误统一映射 ✓。
路由遮蔽验证：static media 目录成功接管 [resource] 参数路由（upload/raw/list 实测）。

## 8. Analytics

不适用。

## 9. 权限矩阵

| 操作 | 未登录 | Viewer | Editor | Admin |
|---|---:|---:|---:|---:|
| GET /media/:key（公开访问文件） | ✅ | ✅ | ✅ | ✅ |
| 上传/编辑/删除 | ❌ 401 | ❌ | ✅ | ✅ |

实测：未登录 upload → 401。

## 10. 多语言检查

[x] alt/caption 进 media_translations  [x] UNIQUE(media_id, locale_id)  [x] 记录返回 locale code 键（前端契约一致）  [x] 新增 Locale 无 schema 改动

## 11. 测试计划

- Unit：sanitizeMediaFilename（路径穿越/控制字符/unicode/255 截断/空名回退）、isSafeStorageKey（格式与穿越拒绝）。
- Integration（实测）：上传（mime/size/url）→ 公开投递（字节逐位一致、content-type）→ raw 门控 → PUT 翻译（zh-CN/en，code 键回显）→ 列表 → 删除（行/字节/公开 404）→ 未登录 401。

## 12. 验收标准（节选）

~~~text
Given 管理员上传 10MB 内文件
When 上传完成
Then 记录入库、字节落存储、url 指向 /media/{key} 且公开可访问

Given 未登录调用上传
Then 401；超过 10MB 则 413

Given 编辑信息填入 zh-CN alt
When 保存并重新打开
Then LocalizedField 在 zh-CN Tab 显示已存值

Given 删除媒体
When 再次 GET /media/{key}
Then 404 且存储目录无残留字节
~~~

## 13. 质量闸门

~~~text
npm run lint      → PASS
npm run typecheck → PASS
npm test          → PASS（113 tests / 17 files）
npm run build     → PASS
集成验证          → 上传/公开投递/翻译/删除/401 全链路实测；媒体库页空状态浏览器验证
~~~

## 14. 发布、监控与回滚

~~~text
Migration 顺序: 0005（追加）
环境变量: 无新增（存储仍用 nitro fs driver .data/media；对象存储为 P19）
回滚方式: DROP 两表 + 还原 MediaResource/路由
~~~

## 15. 完成记录

~~~text
Phase Status: COMPLETE
Acceptance: PASS
Known Issues:
  - width/height 未探测（上传图片显示 null），随 P04 选择器一并处理
  - alt/caption 编辑走行内 Action 弹窗；正式编辑页随 P04 featured_image 选择器
Follow-up: P04 Posts + Taxonomy（含媒体选择器与 width/height 回填）
~~~
