$ErrorActionPreference = 'Stop'
$baseUrl = 'http://127.0.0.1:3001'
$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$headers = @{ 'Content-Type' = 'application/json' }

if ([string]::IsNullOrWhiteSpace($env:BLOG_ADMIN_EMAIL) -or [string]::IsNullOrWhiteSpace($env:BLOG_ADMIN_PASSWORD)) {
  throw 'Set BLOG_ADMIN_EMAIL and BLOG_ADMIN_PASSWORD before running this development seed.'
}

$login = Invoke-WebRequest -Uri "$baseUrl/api/auth/login" -Method Post -Headers $headers -WebSession $session `
  -Body (@{ email = $env:BLOG_ADMIN_EMAIL; password = $env:BLOG_ADMIN_PASSWORD } | ConvertTo-Json) -SkipHttpErrorCheck
if ($login.StatusCode -ne 200) { throw "Login failed: $($login.StatusCode) $($login.Content)" }

$pages = @{
  about = @{ template = 'about'; title = '关于本站'; content = '<p>NuxtBlog 是一个以内容为中心的个人站点，文章、作品、链接和数字服务都在这里被认真整理。</p><h2>这里有什么</h2><p>你可以阅读独立文章、浏览分类、查看作者资料，也可以探索商城与会员内容。</p><h2>正在发生</h2><p>这是一个持续迭代的实验场，页面、导航和内容都可以在后台独立维护。</p>'; enTitle = 'About this site'; enContent = '<p>NuxtBlog is a content-first personal site where articles, projects, links, and digital services live together.</p><h2>What you can find here</h2><p>Read independent articles, browse topics, explore the author profile, and discover digital products.</p><h2>Always evolving</h2><p>This is a living workshop maintained from the admin panel.</p>' }
  'privacy-policy' = @{ template = 'privacy'; title = '隐私政策'; content = '<p>我们只收集运行账号、订单、评论和站点服务所必需的信息。</p><h2>我们收集的信息</h2><p>注册、购买或评论时，可能会保存邮箱、订单信息和必要的安全日志。</p><h2>信息如何使用</h2><p>这些信息用于登录、支付处理、内容交付、评论审核和服务通知。</p><h2>你的权利</h2><p>你可以联系管理员申请导出、更正或删除个人数据。</p>'; enTitle = 'Privacy Policy'; enContent = '<p>We collect only the information needed to operate accounts, orders, comments, and site services.</p><h2>Information we collect</h2><p>Registration, purchases, and comments may require an email address, order details, and limited security logs.</p><h2>How we use it</h2><p>Information is used for sign-in, payment processing, content delivery, moderation, and service notices.</p><h2>Your choices</h2><p>You may contact the administrator to export, correct, or delete personal data.</p>' }
  'terms-of-use' = @{ template = 'terms'; title = '使用条款'; content = '<p>欢迎使用本站内容、社区和数字商品服务。继续访问或购买即表示你同意以下约定。</p><h2>内容与账号</h2><p>请使用真实、合法且不侵犯他人权益的内容，并妥善保管账号凭据。</p><h2>购买与退款</h2><p>数字商品在支付成功后按商品说明交付，遇到问题请提供订单号联系我们。</p><h2>责任范围</h2><p>本站内容按现状提供，文章观点不构成专业建议。</p>'; enTitle = 'Terms of Use'; enContent = '<p>Welcome to the site, community, and digital services. By continuing to use them, you agree to these terms.</p><h2>Content and accounts</h2><p>Please use lawful content and keep your account credentials secure.</p><h2>Purchases and refunds</h2><p>Digital goods are delivered after successful payment. Include your order number when reporting an issue.</p><h2>Liability</h2><p>Site content is provided as-is and is not professional advice.</p>' }
}

$all = Invoke-RestMethod -Uri "$baseUrl/api/admin/pages?perPage=200" -WebSession $session
$updated = 0
foreach ($page in $all.items) {
  $seed = $pages[[string]$page.alias]
  if ($null -eq $seed) { continue }
  $translations = @{ 'zh-CN' = @{ title = $seed.title; content = $seed.content; seoTitle = $seed.title; seoDescription = $seed.title } }
  if ($seed.enTitle -and $seed.enContent) { $translations.en = @{ title = $seed.enTitle; content = $seed.enContent; seoTitle = $seed.enTitle; seoDescription = $seed.enTitle } }
  $body = @{ template = $seed.template; translations = $translations } | ConvertTo-Json -Depth 8
  Invoke-RestMethod -Uri "$baseUrl/api/admin/pages/$($page.id)" -Method Put -Headers $headers -WebSession $session -Body $body | Out-Null
  $updated++
}
[PSCustomObject]@{ updated = $updated; aliases = ($pages.Keys -join ', ') }
