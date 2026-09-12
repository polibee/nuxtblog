import { requirePermission, getSessionUser } from '../../../../../utils/auth'
import { approveSubmission } from '../../../../../modules/friend-links/friend-links.runtime.service'

/** POST /api/admin/friend-links/submissions/:id/approve — §43/44: the
    admin edits the normalized data first, approval creates the
    FriendLink in a transaction. */
export default defineEventHandler(async (event) => {
  await requirePermission(event, 'friend-links.edit')
  const user = await getSessionUser(event)
  const id = Number(getRouterParam(event, 'id')) || 0
  if (!id) throw createError({ statusCode: 422, statusMessage: 'invalid id' })
  const body = await readBody(event) as Record<string, unknown>
  const result = await approveSubmission(id, { userId: user?.id ?? null }, {
    siteName: body?.siteName !== undefined ? String(body.siteName) : undefined,
    siteUrl: body?.siteUrl !== undefined ? String(body.siteUrl) : undefined,
    description: body?.description !== undefined ? String(body.description) : undefined,
    logoUrl: body?.logoUrl !== undefined ? String(body.logoUrl || '') : undefined,
    categoryId: body?.categoryId !== undefined ? Number(body.categoryId) || null : undefined,
    featured: body?.featured !== undefined ? Boolean(body.featured) : undefined,
    nofollow: body?.nofollow !== undefined ? Boolean(body.nofollow) : undefined,
    backlinkUrl: body?.backlinkUrl !== undefined ? String(body.backlinkUrl || '') : undefined
  })
  return result
})
