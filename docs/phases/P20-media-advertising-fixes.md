# P20 广告后台修复 + Slider 修复 + Media 资产中心 v1

## 1. 基本信息

~~~text
Phase ID: P20
Phase Name: 广告后台 Paginated 修复 / Slider 启停修复 / Media 资产中心（media.txt P0）
Owner: polibee
NuxtAdmin Base Commit: a48695f
Depends On: P03（Media）、P16（媒体库 UI）、P17（广告）、P19（Slider）
Target Version: v0.2.0-p20
Status: COMPLETE
设计依据：docs/media.txt（100 节媒体资产中心设计）
~~~

## 2. 实现范围（摘要）

### P20.1 广告后台列表修复

- 4 个 advertising 列表端点（slots/campaigns/creatives/placements）返回裸数组导致框架表格永久"加载中…"——统一改为标准 Paginated（与 P13d 商品列表同款问题）
- "多个菜单都是广告计划"是列表卡死时页面未切换的表象，数据渲染后标题正常区分

### P20.2 Slider 启停修复

- 后台设置开关原本需点"保存"才落库（用户只拨了开关）——5 个开关改为 patchSetting 即改即存
- 已代为启用 home.hero（含 1 个测试 slide），首页 SSR 已验证渲染轮播

### P20.3 Media 资产中心 v1（media.txt P0）

- **迁移 0024**：media + usage_type/hash + media_variants 表（UNIQUE(media_id,variant)，FK cascade）
- **变体生成**：依赖 sharp（nitro externals 实测无需配置）——上传时对 png/jpeg/webp 生成 thumbnail(400×400 cover)/medium(768w)/large(1280w) webp 三档；sharp.rotate() 自动摆正 EXIF 方向、默认剥离元数据（GPS）；GIF 跳过、原图永不修改（Rule 1）
- **变体服务**：/media/:key 路由先查 media 再查 media_variants（webp Content-Type）
- **去重**：上传计算 SHA-256，响应带 duplicateOf（§54）
- **引用检查**：media-reference.service 按 §92 适配器模式查询——文章封面（结构列）、轮播 item、广告创意、侧边栏卡片 + 正文 mediumtext LIKE 扫描；删除保护：DELETE 409 + references 数据（§35-36）
- **筛选**：usage_type / 使用中 / 未使用（引用 id 集合）/ 缺失 Alt（translations alt=''）
- **MediaLibraryPage 重写**：1:1 方格缩略图（JPEG cover；PNG/GIF/WebP 棋盘格 contain）、用途/使用状态/缺失 Alt 筛选、详情抽屉（预览/元数据/文件夹+用途编辑/多语言 Alt+Caption 保存/被引用列表/变体清单/复制 URL/删除）、全屏 Lightbox（95vw/92vh、object-contain、缩放 25%~600%、滚轮缩放、拖拽平移、双击放大、Fullscreen API、键盘 ←→+−ESC、页码导航、下载原图）
- **MediaPickerField**（ADR 0004 增补）：usage 过滤 + 上传自动归类 + recommended 规格提示；SliderManagerPage 桌面/移动图选择器已接 16:7/4:3 提示

## 3. 验证结果

~~~text
npm run lint      → PASS（0 errors；既有 v-html 警告 1 条可接受）
npm run typecheck → PASS
npm test          → PASS（167 tests / 21 files）
npm run build     → PASS
真实 MySQL E2E    → PASS
~~~

## 4. 真实环境 E2E

- 广告 slots/campaigns API → Paginated 形状；sliders API 正常
- 上传 PNG（usageType=slider）→ 变体 3 档生成 + DB 行 + /media/{key} 200 image/webp；重复上传 → duplicateOf 命中
- GET /api/admin/media/3/references → [{module:'slider', label:'首页轮播 (home.hero)'}]；DELETE media/3 → 409 + references；DELETE 未引用媒体 → 200
- 排障记录：E2E 中途多次 curl 000 为 `;filename=` 参数在 Git Bash 下被破坏所致，与服务端无关

## 5. 完成记录

~~~text
Phase Status: COMPLETE
Acceptance: PASS（四道闸门 + 真实环境端到端；media.txt P0 全部落地）
Known Issues: 未做 Usage-specific 懒生成变体（slider_desktop 等，当前前端 CSS object-cover 等效）；Crop Editor、Replace Media、批量操作、Paste 上传留待 P0.1；正文件 LIKE 引用扫描无索引（dev 规模可接受）
Follow-up: Crop Editor（固定比例）、Replace Media、批量移动/打标、最近上传筛选、AVIF 输出
~~~
