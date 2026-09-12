import { eq } from 'drizzle-orm'
import { requirePermission } from '../../../utils/auth'
import { getDb, isBlogDbReady } from '../../../repositories/db.server'
import { sidebarCards } from '../../../repositories/schema/sidebar-cards'
import { authorCardConfigSchema } from '#shared/schemas/author-card'

/** PUT /api/admin/sidebar/author-card — create or update the author
    card row from the visual form (config JSON is storage-only). */
export default defineEventHandler(async (event) => {
  await requirePermission(event, 'sidebar-cards.edit')
  if (!isBlogDbReady()) {
    throw createError({ statusCode: 503, statusMessage: 'Database unavailable' })
  }
  const body = await readBody(event) as { config?: unknown, enabled?: boolean, sortOrder?: number }
  const parsed = authorCardConfigSchema.safeParse(body?.config)
  if (!parsed.success) {
    throw createError({ statusCode: 422, statusMessage: parsed.error.issues[0]?.message ?? 'Invalid author card config' })
  }
  const db = getDb()
  const [existing] = await db.select({ id: sidebarCards.id })
    .from(sidebarCards)
    .where(eq(sidebarCards.type, 'author'))
    .limit(1)

  if (existing) {
    await db.update(sidebarCards).set({
      config: parsed.data,
      ...(body?.enabled !== undefined ? { enabled: body.enabled } : {}),
      ...(body?.sortOrder !== undefined ? { sortOrder: body.sortOrder } : {})
    }).where(eq(sidebarCards.id, existing.id))
    return { ok: true, id: existing.id }
  }

  const [row] = await db.insert(sidebarCards).values({
    type: 'author',
    config: parsed.data,
    enabled: body?.enabled ?? true,
    sortOrder: body?.sortOrder ?? 5
  })
  return { ok: true, id: row!.insertId }
})
