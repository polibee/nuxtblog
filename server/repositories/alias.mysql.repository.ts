import { eq } from 'drizzle-orm'
import { getDb } from './db.server'
import { urlRedirects } from './schema/redirects'

export async function findRedirect(oldPath: string) {
  const rows = await getDb().select().from(urlRedirects).where(eq(urlRedirects.oldPath, oldPath)).limit(1)
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
  await getDb().insert(urlRedirects).values({ ...input, localeId: input.localeId ?? null })
}
