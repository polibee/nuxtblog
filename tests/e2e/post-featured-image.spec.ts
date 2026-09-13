import { expect, test } from '@playwright/test'

const baseUrl = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:3000'
const adminEmail = process.env.BLOG_ADMIN_EMAIL ?? 'admin@example.com'
const adminPassword = process.env.BLOG_ADMIN_PASSWORD ?? 'admin123456'

test('admin can publish, reload, and clear a post featured image', async ({ page }) => {
  const alias = `featured-image-e2e-${Date.now()}`
  let postId: number | undefined

  try {
    await page.goto(`${baseUrl}/login?redirect=/admin/posts`)
    await page.getByLabel(/邮箱|email/i).fill(adminEmail)
    await page.getByLabel(/密码|password/i).fill(adminPassword)
    await page.getByRole('button', { name: /登录|sign in/i }).click()
    await expect(page).toHaveURL(/\/admin\/posts/)

    const mediaResponse = await page.request.get(`${baseUrl}/api/admin/media`, {
      params: { perPage: 1, usageType: 'cover' }
    })
    expect(mediaResponse.ok()).toBeTruthy()
    const mediaPayload = await mediaResponse.json() as {
      items?: Array<{ id: number, filename: string, storageKey: string }>
    }
    const media = mediaPayload.items?.[0]
    if (!media) throw new Error('Featured-image E2E prerequisite unavailable: no media record exists')

    const createResponse = await page.request.post(`${baseUrl}/api/admin/posts`, {
      data: {
        alias,
        status: 'draft',
        featuredMediaId: null,
        translations: {
          'zh-CN': {
            title: 'Featured image E2E fixture',
            content: '<p>Featured image E2E fixture</p>'
          }
        }
      }
    })
    expect(createResponse.ok()).toBeTruthy()
    const created = await createResponse.json() as { id: number }
    postId = created.id

    await page.goto(`${baseUrl}/admin/posts/${postId}/edit`)
    await page.getByRole('button', { name: /选择|choose from the media library/i }).click()
    await page.getByRole('button', { name: new RegExp(media.filename.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) }).click()
    await page.getByRole('button', { name: /保存更改|save changes/i }).click()

    const publishResponse = await page.request.put(`${baseUrl}/api/admin/posts/${postId}`, {
      data: { status: 'published' }
    })
    expect(publishResponse.ok()).toBeTruthy()

    await page.goto(`${baseUrl}/admin/posts/${postId}/edit`)
    await expect(page.locator('img[alt="' + media.filename + '"]')).toBeVisible()
    await page.goto(`${baseUrl}/posts/${alias}?locale=zh-CN`)
    await expect(page.locator('img.article-cover')).toHaveAttribute('src', `/media/${media.storageKey}`)

    await page.goto(`${baseUrl}/admin/posts/${postId}/edit`)
    await page.locator('button').filter({ hasText: /取消|cancel/i }).first().click()
    await page.getByRole('button', { name: /保存更改|save changes/i }).click()
    await page.goto(`${baseUrl}/posts/${alias}?locale=zh-CN`)
    await expect(page.locator('img.article-cover')).toHaveCount(0)
  } finally {
    if (postId !== undefined) {
      const cleanup = await page.request.delete(`${baseUrl}/api/admin/posts/${postId}`)
      expect(cleanup.ok()).toBeTruthy()
    }
  }
})
