import { requirePermission, getSessionUser } from '../../../../utils/auth'
import { insertNotificationChannel } from '../../../../repositories/notification-channel.runtime.repository'
import { encryptSecret } from '../../../../utils/encryption'

const PROVIDERS = ['webhook', 'lark', 'spug'] as const

/** POST /api/admin/notifications/channels — create a channel; the whole
    config JSON is AES-GCM encrypted at rest (webhook.txt §59). */
export default defineEventHandler(async (event) => {
  await requirePermission(event, 'notifications.edit')
  const user = await getSessionUser(event)
  const body = await readBody(event) as {
    name?: string
    provider?: string
    config?: Record<string, unknown>
  }
  const name = String(body?.name ?? '').trim().slice(0, 80)
  const provider = String(body?.provider ?? '')
  const config = (body?.config ?? {}) as Record<string, unknown>
  if (!name || !PROVIDERS.includes(provider as typeof PROVIDERS[number])) {
    throw createError({ statusCode: 422, statusMessage: 'name and a valid provider are required' })
  }
  if (!String(config.url ?? '').trim()) {
    throw createError({ statusCode: 422, statusMessage: 'config.url is required' })
  }
  const configHint = provider === 'spug'
    ? String(config.url).replace(/\/(xsend|send|sms|mail)\/.+$/, '/$1/••••')
    : String(config.url).replace(/(\/[^/]{8})[^/]*$/, '$1••••')
  const id = await insertNotificationChannel({
    name,
    provider,
    configEncrypted: JSON.stringify(encryptSecret(JSON.stringify(config))),
    configHint,
    createdBy: user?.id ?? null
  })
  return { id }
})
