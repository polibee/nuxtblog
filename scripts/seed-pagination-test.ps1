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

1..15 | ForEach-Object {
  $number = $_.ToString('00')
  $body = @{
    alias = "pagination-test-$number"
    status = 'published'
    commentStatus = 'open'
    translations = @{
      'zh-CN' = @{
        title = "分页测试文章 $number"
        excerpt = '用于观察首页列表与分页布局的测试文章。'
        content = '<p>这是一篇用于测试多文章列表、评论数展示和分页效果的示例内容。</p>'
        seoTitle = "分页测试文章 $number"
        seoDescription = "分页测试文章 $number"
      }
      en = @{
        title = "Pagination test article $number"
        excerpt = 'A sample article for checking list and pagination layouts.'
        content = '<p>This sample article helps verify multi-post lists, comment counts, and pagination.</p>'
        seoTitle = "Pagination test article $number"
        seoDescription = "Pagination test article $number"
      }
    }
  } | ConvertTo-Json -Depth 6
  Invoke-RestMethod -Uri "$baseUrl/api/admin/posts" -Method Post -Body $body -Headers $jsonHeaders -WebSession $session | Out-Null
}

$result = Invoke-RestMethod -Uri "$baseUrl/api/public/posts?locale=zh-CN&page=1&perPage=50"
[PSCustomObject]@{ Total = $result.total; TestCount = @($result.items | Where-Object { $_.alias -like 'pagination-test-*' }).Count }
