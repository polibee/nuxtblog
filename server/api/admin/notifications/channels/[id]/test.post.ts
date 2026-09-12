import { requirePermission } from '../../../../../utils/auth'
import { testChannel } from '../../../../../modules/notifications/engine'

/** POST /api/admin/notifications/channels/:id/test — Test Channel
    (webhook.txt §42). */
export default defineEventHandler(async (event) => {
  await requirePermission(event, 'notifications.edit')
  const id = Number(getRouterParam(event, 'id')) || 0
  if (!id) throw createError({ statusCode: 422, statusMessage: 'invalid id' })
  return await testChannel(id)
})
