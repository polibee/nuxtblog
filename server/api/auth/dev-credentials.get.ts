/** Legacy admin-only hint endpoint. Use /api/auth/public-credentials for the login page. */
export default defineEventHandler(() => {
  if (process.env.BLOG_ADMIN_PUBLIC !== 'true') {
    throw createError({ statusCode: 404, statusMessage: 'Not found' })
  }
  return {
    email: process.env.BLOG_ADMIN_EMAIL ?? 'admin@example.com',
    password: process.env.BLOG_ADMIN_PASSWORD ?? 'admin123456'
  }
})
