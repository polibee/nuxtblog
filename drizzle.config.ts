import { defineConfig } from 'drizzle-kit'

// reads the same env the Nitro runtime uses (.env via nuxt; plain env for CLI)
const driver = process.env.DB_DRIVER ?? process.env.BLOG_DB_DRIVER ?? 'mysql'
const isPostgres = driver === 'postgres' || driver === 'supabase'
const url = process.env.BLOG_DATABASE_URL ?? process.env.DATABASE_URL ?? (
  isPostgres
    ? `postgresql://${process.env.DB_USER ?? 'postgres'}:${process.env.DB_PASSWORD ?? ''}@${process.env.DB_HOST ?? '127.0.0.1'}:${process.env.DB_PORT ?? '5432'}/${process.env.DB_NAME ?? 'nuxtblog'}${process.env.DB_SSL === 'true' ? '?sslmode=require' : ''}`
    : `mysql://${process.env.BLOG_DB_USER ?? 'root'}:${process.env.BLOG_DB_PASSWORD ?? ''}@${process.env.BLOG_DB_HOST ?? '127.0.0.1'}:${process.env.BLOG_DB_PORT ?? '3306'}/${process.env.BLOG_DB_NAME ?? 'nuxtblog'}`
)

export default defineConfig({
  dialect: isPostgres ? 'postgresql' : 'mysql',
  schema: isPostgres ? './server/database/schema/postgres/index.ts' : './server/database/schema/mysql/index.ts',
  out: isPostgres ? './supabase/migrations/generated' : './server/repositories/migrations',
  dbCredentials: { url }
})
