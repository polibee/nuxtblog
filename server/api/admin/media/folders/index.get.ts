import { asc, count } from 'drizzle-orm'
import { createError } from 'h3'
import { requirePermission } from '../../../../utils/auth'
import { getDb, isBlogDbReady } from '../../../../repositories/db.server'
import { media, mediaFolders } from '../../../../repositories/schema/media'
import type { Paginated } from '#shared/types/api'

/** GET /api/admin/media/folders — media library categories (paginated
    for the framework table / relation selects) */
export default defineEventHandler(async (event) => {
  await requirePermission(event, 'media.view')
  if (!isBlogDbReady()) {
    throw createError({ statusCode: 503, statusMessage: 'Database unavailable' })
  }
  const query = getQuery(event) as { page?: number, perPage?: number }
  const page = Math.max(Number(query.page) || 1, 1)
  const perPage = Math.min(Math.max(Number(query.perPage) || 50, 1), 200)
  const [totals] = await getDb().select({ total: count() }).from(mediaFolders)
  const total = totals?.total ?? 0
  const rows = await getDb()
    .select({ id: mediaFolders.id, name: mediaFolders.name, createdAt: mediaFolders.createdAt })
    .from(mediaFolders)
    .orderBy(asc(mediaFolders.name))
    .limit(perPage)
    .offset((page - 1) * perPage)
  const countRows = await getDb()
    .select({ folderId: media.folderId, total: count() })
    .from(media)
    .groupBy(media.folderId)
  const counts = new Map<number | null, number>()
  for (const r of countRows) counts.set(r.folderId, r.total)
  const items = rows.map(f => ({ ...f, mediaCount: counts.get(f.id) ?? 0 }))
  const result: Paginated<{ id: number, name: string, createdAt: Date, mediaCount: number }> = {
    items,
    total,
    page,
    perPage,
    totalPages: Math.max(Math.ceil(total / perPage), 1)
  }
  return result
})
