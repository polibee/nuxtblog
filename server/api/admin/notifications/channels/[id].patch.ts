import { requirePermission } from '../../../../utils/auth'
import { updateNotificationChannel } from '../../../../repositories/notification-channel.runtime.repository'
import { encryptSecret } from '../../../../utils/encryption'

/** PATCH /api/admin/notifications/channels/:id — rename / toggle /
    replace config (empty config keeps the stored one, §44 Replace). */
export default defineEventHandler(async (event) => {
  await requirePermission(event, 'notifications.edit')
  const id = Number(getRouterParam(event, 'id')) || 0
  if (!id) throw createError({ statusCode: 422, statusMessage: 'invalid id' })
  const body = await readBody(event) as {
    name?: string
    enabled?: boolean
    config?: Record<string, unknown>
  }
  const patch: Record<string, unknown> = {}
  if (body?.name !== undefined) patch.name = String(body.name).trim().slice(0, 80)
  if (body?.enabled !== undefined) patch.enabled = Boolean(body.enabled)
  if (body?.config && String(body.config.url ?? '').trim()) {
    patch.configEncrypted = JSON.stringify(encryptSecret(JSON.stringify(body.config)))
  }
  if (Object.keys(patch).length > 0) {
    await updateNotificationChannel(id, patch)
  }
  return { ok: true }
})
