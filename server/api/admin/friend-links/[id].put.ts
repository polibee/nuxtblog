import { requirePermission } from '../../../utils/auth'
import { updateFriendLink } from '../../../modules/friend-links/friend-links.runtime.service'

/** PUT /api/admin/friend-links/:id — edit a friend link (§40). */
export default defineEventHandler(async (event) => {
  await requirePermission(event, 'friend-links.edit')
  const id = Number(getRouterParam(event, 'id')) || 0
  if (!id) throw createError({ statusCode: 422, statusMessage: 'invalid id' })
  const body = await readBody(event) as Record<string, unknown>
  await updateFriendLink(id, {
    name: body?.name !== undefined ? String(body.name) : undefined,
    url: body?.url !== undefined ? String(body.url) : undefined,
    description: body?.description !== undefined ? String(body.description) : undefined,
    logoMediaId: body?.logoMediaId !== undefined ? Number(body.logoMediaId) || null : undefined,
    externalLogoUrl: body?.externalLogoUrl !== undefined ? String(body.externalLogoUrl || '') : undefined,
    categoryId: body?.categoryId !== undefined ? Number(body.categoryId) || null : undefined,
    featured: body?.featured !== undefined ? Boolean(body.featured) : undefined,
    sortOrder: body?.sortOrder !== undefined ? Number(body.sortOrder) || 0 : undefined,
    backlinkRequired: body?.backlinkRequired !== undefined ? Boolean(body.backlinkRequired) : undefined,
    backlinkUrl: body?.backlinkUrl !== undefined ? String(body.backlinkUrl || '') : undefined,
    nofollow: body?.nofollow !== undefined ? Boolean(body.nofollow) : undefined,
    openInNewTab: body?.openInNewTab !== undefined ? Boolean(body.openInNewTab) : undefined,
    status: body?.status !== undefined ? String(body.status) : undefined
  })
  return { ok: true }
})
