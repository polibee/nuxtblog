import { requirePermission } from '../../../utils/auth'
import { createFriendLink } from '../../../modules/friend-links/friend-links.runtime.service'

/** POST /api/admin/friend-links — create a friend link manually. */
export default defineEventHandler(async (event) => {
  await requirePermission(event, 'friend-links.edit')
  const body = await readBody(event) as Record<string, unknown>
  const id = await createFriendLink({
    name: String(body?.name ?? ''),
    url: String(body?.url ?? ''),
    description: body?.description ? String(body.description) : undefined,
    logoMediaId: body?.logoMediaId ? Number(body.logoMediaId) : null,
    externalLogoUrl: body?.externalLogoUrl ? String(body.externalLogoUrl) : null,
    categoryId: body?.categoryId ? Number(body.categoryId) : null,
    featured: Boolean(body?.featured),
    sortOrder: Number(body?.sortOrder) || 0,
    backlinkRequired: Boolean(body?.backlinkRequired),
    backlinkUrl: body?.backlinkUrl ? String(body.backlinkUrl) : null,
    nofollow: Boolean(body?.nofollow),
    openInNewTab: body?.openInNewTab === undefined ? true : Boolean(body.openInNewTab)
  })
  return { id }
})
