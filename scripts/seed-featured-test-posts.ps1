$ErrorActionPreference = 'Stop'
$baseUrl = 'http://127.0.0.1:3001'
$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$jsonHeaders = @{ 'Content-Type' = 'application/json' }

$adminEmail = $env:BLOG_ADMIN_EMAIL
$adminPassword = $env:BLOG_ADMIN_PASSWORD
if ([string]::IsNullOrWhiteSpace($adminEmail) -or [string]::IsNullOrWhiteSpace($adminPassword)) {
  throw 'Set BLOG_ADMIN_EMAIL and BLOG_ADMIN_PASSWORD before running this development seed.'
}

$login = Invoke-WebRequest -Uri "$baseUrl/api/auth/login" -Method Post `
  -Body (@{ email = $adminEmail; password = $adminPassword } | ConvertTo-Json) `
  -Headers $jsonHeaders -WebSession $session -SkipHttpErrorCheck
if ($login.StatusCode -ne 200) { throw "Login failed: $($login.StatusCode) $($login.Content)" }

$media = Invoke-RestMethod -Uri "$baseUrl/api/admin/media?perPage=50&sortBy=createdAt&sortDir=desc" `
  -WebSession $session
$covers = @($media.items | Where-Object { $_.mime -like 'image/*' } | Select-Object -ExpandProperty id)

$posts = @(
  @{ alias = 'demo-aurora-interface'; zh = '极光界面：把夜色做成一张可交互的地图'; en = 'Aurora Interface: Turning Night into an Interactive Map'; cover = 0; zhBody = '<p>我们把一束极光拆成颜色、节奏和留白，再把它们重新编排成一个可以探索的数字界面。</p><p>这篇文章记录一次从灵感采集到界面落地的设计实验。</p>' },
  @{ alias = 'demo-coffee-and-code'; zh = '咖啡、代码与一场小型远足'; en = 'Coffee, Code, and a Small Hike'; cover = 1; zhBody = '<p>周末带上电脑和一杯手冲咖啡，去城市边缘寻找一张适合写代码的长椅。</p><p>真正高效的工作空间，有时只需要阳光、风和一个不会打扰你的下午。</p>' },
  @{ alias = 'demo-slow-web-garden'; zh = '慢网页花园：给内容留一点呼吸感'; en = 'The Slow Web Garden: Let Content Breathe'; cover = 2; zhBody = '<p>网页不必永远追求更多动效和更快的节奏，内容本身也值得拥有安静、清晰的阅读空间。</p><p>我们从排版、图片和导航三个角度，整理一套轻量的内容设计方法。</p>' },
  @{ alias = 'demo-mysql-observatory'; zh = 'MySQL 观测站：记录一条数据的旅程'; en = 'MySQL Observatory: Following a Row of Data'; cover = 3; zhBody = '<p>从表单提交到页面呈现，一条数据会经历校验、持久化、缓存和再次读取。</p><p>用可视化的方式理解这条旅程，能让系统维护变得更从容。</p>' }
)

$created = 0
foreach ($post in $posts) {
  $coverId = $null
  if ($covers.Count -gt $post.cover) { $coverId = [int]$covers[$post.cover] }
  $body = @{
    alias = $post.alias
    status = 'published'
    commentStatus = 'open'
    featuredMediaId = $coverId
    translations = @{
      'zh-CN' = @{ title = $post.zh; excerpt = ''; content = $post.zhBody; seoTitle = $post.zh; seoDescription = $post.zh }
      en = @{ title = $post.en; excerpt = ''; content = ($post.zhBody -replace '周末带上电脑和一杯手冲咖啡，去城市边缘寻找一张适合写代码的长椅。', 'Bring a laptop and coffee to the edge of the city, and find a bench made for writing code.' -replace '我们把一束极光拆成颜色、节奏和留白，再把它们重新编排成一个可以探索的数字界面。', 'We split an aurora into color, rhythm, and whitespace, then compose it into an interface worth exploring.' -replace '网页不必永远追求更多动效和更快的节奏，内容本身也值得拥有安静、清晰的阅读空间。', 'The web does not always need more motion or speed; content deserves a calm and clear reading space.' -replace '从表单提交到页面呈现，一条数据会经历校验、持久化、缓存和再次读取。', 'From form submission to page render, a row travels through validation, persistence, caching, and retrieval.'); seoTitle = $post.en; seoDescription = $post.en }
    }
  } | ConvertTo-Json -Depth 8
  $response = Invoke-WebRequest -Uri "$baseUrl/api/admin/posts" -Method Post -Body $body -Headers $jsonHeaders -WebSession $session -SkipHttpErrorCheck
  if ($response.StatusCode -eq 201 -or $response.StatusCode -eq 200) { $created++ }
  elseif ($response.StatusCode -ne 409) { throw "Seed failed for $($post.alias): $($response.StatusCode) $($response.Content)" }
}

$public = Invoke-RestMethod -Uri "$baseUrl/api/public/posts?locale=zh-CN&page=1&perPage=50"
[PSCustomObject]@{
  created = $created
  total = $public.total
  demoPosts = @($public.items | Where-Object { $_.alias -like 'demo-*' } | Select-Object alias, title, excerpt, coverUrl)
}
