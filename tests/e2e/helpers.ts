import { expect, type Page } from '@playwright/test'

export const adminEmail = process.env.E2E_ADMIN_EMAIL ?? process.env.BLOG_ADMIN_EMAIL ?? 'admin@example.com'
export const adminPassword = process.env.E2E_ADMIN_PASSWORD ?? process.env.BLOG_ADMIN_PASSWORD ?? 'admin123456'

export async function loginAsAdmin(page: Page): Promise<void> {
  const response = await page.request.post('/api/auth/login', { data: { email: adminEmail, password: adminPassword } })
  expect(response.ok(), `admin login failed: ${response.status()} ${await response.text()}`).toBeTruthy()
  const me = await page.request.get('/api/auth/me')
  expect(me.ok()).toBeTruthy()
  const payload = await me.json() as { user?: { role?: string } }
  expect(payload.user?.role).toBe('admin')
}

export async function json<T>(page: Page, path: string, options?: Parameters<Page['request']['fetch']>[1]): Promise<T> {
  const response = await page.request.fetch(path, options)
  expect(response.ok(), `${options?.method ?? 'GET'} ${path} failed: ${response.status()} ${await response.text()}`).toBeTruthy()
  return response.json() as Promise<T>
}

export async function firstPublishedPost(page: Page): Promise<{ id: number, alias: string }> {
  const payload = await json<{ posts?: Array<{ id: number, alias: string }> }>(page, '/api/public/posts?locale=zh-CN&perPage=1')
  const post = payload.posts?.[0]
  testCondition(Boolean(post), 'no published post is available')
  return post!
}

export function testCondition(condition: boolean, reason: string): asserts condition {
  if (!condition) throw new Error(`E2E prerequisite unavailable: ${reason}`)
}

export async function expectJsonStatus(page: Page, path: string, status: number, options?: Parameters<Page['request']['fetch']>[1]): Promise<void> {
  const response = await page.request.fetch(path, options)
  expect(response.status(), `${options?.method ?? 'GET'} ${path}: ${await response.text()}`).toBe(status)
}
