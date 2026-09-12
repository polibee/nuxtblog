import { eq } from 'drizzle-orm'
import { getPostgresDb } from './db-postgres.server'
import { urlRedirects } from './schema-postgres/redirects'

export async function findRedirect(oldPath: string) {
  const rows = await getPostgresDb().select().from(urlRedirects).where(eq(urlRedirects.oldPath, oldPath)).limit(1)
  return rows[0]
}

export async function insertRedirect(input: {
  entityType: string
  entityId: number
  localeId?: number | null
  oldPath: string
  newPath: string
  statusCode: 301 | 308
}): Promise<void> {
  await getPostgresDb().insert(urlRedirects).values({ ...input, localeId: input.localeId ?? null })
}
