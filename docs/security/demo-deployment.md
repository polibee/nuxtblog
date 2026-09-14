# 演示站安全部署约束

演示账号用于让访客查看前台、后台导航和只读数据，不用于维护生产站点。

## 默认行为

- 账号由启动 seed 创建，默认角色为 `viewer`；只有显式设置 `DEMO_ACCOUNT_ENABLED=true` 才会创建。
- `DEMO_ACCOUNT_PASSWORD` 只从部署环境读取，不能写入仓库、数据库 seed SQL、日志或截图。
- `DEMO_ACCOUNT_PUBLIC=true` 时，登录页可以通过 `/api/auth/demo-credentials` 展示演示账号；正式业务站默认保持 `false`。
- 演示账号对所有 API 的 `POST`、`PUT`、`PATCH`、`DELETE` 请求统一返回 `403`，登录和退出除外。
- 因此评论、媒体上传、广告购买、支付、设置、导出、通知/Webhook 和用户管理不会被演示账号写入。

## 上线前检查

1. 使用独立数据库或脱敏副本，不让演示站连接真实业务数据库。
2. 使用独立对象存储 bucket，并关闭演示账号的上传权限。
3. `DEMO_ACCOUNT_PUBLIC=true` 只用于公开演示站；真实站点设为 `false` 或 `DEMO_ACCOUNT_ENABLED=false`。
4. 在反向代理启用 HTTPS、请求体大小限制、速率限制和安全响应头。
5. 不把 `DATABASE_URL`、支付密钥、Webhook 密钥、AI key 或管理员凭据放入演示环境。
6. 仍需按项目质量闸门运行 lint、typecheck、unit test、build 和浏览器 E2E。

全局只读中间件是纵深防御，不替代 API 自身的 `requirePermission`、输入校验、富文本清洗和 SSRF 防护。
