/**
 * GET /api/auth/dev-credentials — DEVELOPMENT ONLY convenience.
 * Returns the seed admin credentials (from BLOG_ADMIN_* env) so the
 * login page can display/fill them during development. Disabled in
 * production builds (404); credentials in the DB are scrypt hashes.
 */
export default defineEventHandler(() => {
  if (process.env.NODE_ENV === 'production') {
    throw createError({ statusCode: 404, statusMessage: 'Not found' })
  }
  return {
    email: process.env.BLOG_ADMIN_EMAIL ?? 'admin@example.com',
    password: process.env.BLOG_ADMIN_PASSWORD ?? 'admin123456'
  }
})
