# ADR 0006：Resource 页面覆盖扩展（pages.view / pages.raw）

## 状态

Accepted（2026-09-12，P34 Settings Foundation）

## 背景

Settings 模块重构（docs/设置.txt §63）要求每个设置页拥有独立 URL（`/admin/settings/general`、`/admin/settings/appearance`…），而不是 `?tab=` 查询参数。既有 resource router 仅支持 `pages.list` 覆盖，`/admin/{resource}/{id}` 段固定落到 ResourceViewPage（记录详情页）。

## 决策

1. `CustomPage` 资源契约的 `pages` 扩展为 `{ list?, view?, raw? }`（app/admin/core/types.ts）：
   - `view`：当 `/admin/{resource}/{id}` 的 `{id}` 不是 `create` 且无二级 action 时，优先使用 `pages.view` 覆盖组件，`id` 作为 prop 传入（Settings 用它承载 pageId，实现深链）。
   - `raw`：预留语义位（旧版键值面板以 `/admin/settings/raw` 保留给开发者，S7 Raw Editor 阶段接管）。
2. 权限模型不变：view 覆盖仍受 `{permissionPrefix}.view` 门控。

## 理由

- 设置页是"页"而不是"记录"，但它天然需要独立 URL（刷新/深链/搜索跳转，§63）。复用 resource router 的 id 段承载 pageId 是最小改动路径，不需要为 Settings 引入独立路由表。
- 对既有资源零影响：未声明 `pages.view` 的资源行为与之前完全一致。

## 影响

- 后续所有"子页面型"管理扩展（备份子页、AI 子页）都可以走同一扩展点。
- 违反本 ADR 的替代方案（query 参数 tab、每页注册独立 resource）均被否决：前者不满足 §63，后者会制造几十个伪资源。
