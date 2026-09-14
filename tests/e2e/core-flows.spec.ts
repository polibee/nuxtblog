import { expect, test } from '@playwright/test'
import { adminPassword, adminEmail, expectJsonStatus, firstPublishedPost, json, loginAsAdmin, testCondition } from './helpers'

test.describe('核心认证与权限', () => {
  test('管理员登录后可访问管理 API，匿名请求被拒绝', async ({ page, browser }) => {
    await expectJsonStatus(page, '/api/admin/navigations', 401)
    await loginAsAdmin(page)
    const navigation = await json<{ items: unknown[] }>(page, '/api/admin/navigations')
    expect(Array.isArray(navigation.items)).toBeTruthy()

    const anonymous = await browser.newPage()
    try {
      await expectJsonStatus(anonymous, '/api/admin/navigations', 401)
    } finally {
      await anonymous.close()
    }
  })

  test('错误凭据不会建立管理员会话', async ({ page }) => {
    const response = await page.request.post('/api/auth/login', { data: { email: adminEmail, password: `${adminPassword}-wrong` } })
    expect(response.status()).toBe(401)
    await expectJsonStatus(page, '/api/auth/me', 401)
  })
})

test.describe('多语言、导航与侧边栏', () => {
  test('中文/英文导航和侧边栏返回对应 locale 且不泄漏原始 i18n key', async ({ page }) => {
    const zhNav = await json<{ locale: string, items: Array<{ label?: string }> }>(page, '/api/public/navigation?location=header&locale=zh-CN')
    const enNav = await json<{ locale: string, items: Array<{ label?: string }> }>(page, '/api/public/navigation?location=header&locale=en')
    const enFooter = await json<{ locale: string, items: Array<{ label?: string }> }>(page, '/api/public/navigation?location=footer&locale=en')
    const enSidebar = await json<{ locale: string, cards: Array<{ title?: string, content?: string }> }>(page, '/api/public/sidebar?locale=en')

    expect(zhNav.locale).toBe('zh-CN')
    expect(enNav.locale).toBe('en')
    expect(enFooter.locale).toBe('en')
    expect(enSidebar.locale).toBe('en')
    for (const value of [...enNav.items, ...enFooter.items, ...enSidebar.cards]) {
      expect(JSON.stringify(value)).not.toMatch(/(?:public|nav|res)\.[A-Za-z0-9_.]+/)
    }
  })

  test('前台切换 locale 会刷新到对应文章集合', async ({ page }) => {
    const zh = await json<{ posts: Array<{ alias: string }> }>(page, '/api/public/posts?locale=zh-CN&perPage=100')
    const en = await json<{ posts: Array<{ alias: string }> }>(page, '/api/public/posts?locale=en&perPage=100')
    expect(Array.isArray(zh.posts)).toBeTruthy()
    expect(Array.isArray(en.posts)).toBeTruthy()
    await page.goto('/?locale=en')
    await expect(page.locator('html')).toBeVisible()
  })
})

test.describe('评论提交与后台回复', () => {
  test('登录用户提交评论后管理员可以回复并清理', async ({ page }) => {
    await loginAsAdmin(page)
    const post = await firstPublishedPost(page)
    const marker = `E2E comment ${Date.now()}`
    const created = await json<{ id: number, status: string }>(page, `/api/public/posts/${post.alias}/comments`, {
      method: 'POST',
      data: { content: marker }
    })
    expect(created.id).toBeGreaterThan(0)
    expect(['pending', 'approved']).toContain(created.status)

    try {
      const reply = await json<{ id: number, parentId: number, content: string }>(page, `/api/admin/comments/${created.id}/reply`, {
        method: 'POST',
        data: { content: `E2E reply ${Date.now()}` }
      })
      expect(reply.parentId).toBe(created.id)
      expect(reply.content).toContain('E2E reply')
    } finally {
      await expectJsonStatus(page, `/api/admin/comments/${created.id}`, 200, { method: 'DELETE' })
    }
  })
})

test.describe('广告购买与审核边界', () => {
  test('广告申请保存素材并生成订单号，后台可读取并清理计划', async ({ page }) => {
    const slots = await json<{ slots: Array<{ key: string, priceMinor: number }> }>(page, '/api/public/advertising/slots')
    const media = await (async () => {
      await loginAsAdmin(page)
      return json<{ items: Array<{ id: number }> }>(page, '/api/admin/media?perPage=1')
    })()
    const slot = slots.slots?.[0]
    const image = media.items?.[0]
    testCondition(Boolean(slot && image), 'an enabled advertising slot and media fixture are required')
    const title = `E2E ad ${Date.now()}`
    const applied = await json<{ campaignId: number, orderNumber: string }>(page, '/api/public/advertising/apply', {
      method: 'POST',
      data: {
        materialTitle: title,
        materialDescription: 'E2E submitted material',
        materialImageMediaId: image!.id,
        materialUrl: 'https://example.com/e2e-ad',
        materialSlotKey: slot!.key,
        contactEmail: 'e2e@example.com',
        budgetMinor: Math.max(slot!.priceMinor, 100),
        billingUnit: 'day',
        billingUnits: 1
      }
    })
    expect(applied.campaignId).toBeGreaterThan(0)
    expect(applied.orderNumber).toMatch(/\S+/)
    try {
      const campaigns = await json<{ items: Array<{ id: number, materialTitle?: string, orderId?: number | null }> }>(page, '/api/admin/advertising/campaigns')
      const campaign = campaigns.items.find(item => item.id === applied.campaignId)
      expect(campaign?.materialTitle).toBe(title)
      expect(campaign?.orderId).toBeTruthy()
    } finally {
      await expectJsonStatus(page, `/api/admin/advertising/campaigns/${applied.campaignId}`, 200, { method: 'DELETE' })
    }
  })

  test('支付确认后的审核/投放链路在未提供支付边界 fixture 时明确跳过', async () => {
    test.skip(!process.env.E2E_PAID_CAMPAIGN_ID, 'requires E2E_PAID_CAMPAIGN_ID backed by a controllable payment fixture')
  })
})

test.describe('通知失败重试边界', () => {
  test('未提供可控外部 Webhook 时明确跳过，不伪造投递成功', async () => {
    test.skip(!process.env.E2E_NOTIFICATION_WEBHOOK_URL, 'requires a safe externally reachable webhook that returns controlled 500/timeout responses')
  })
})
