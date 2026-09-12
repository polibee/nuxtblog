import { requirePermission } from '../../../../utils/auth'
import { listNotificationChannels } from '../../../../repositories/notification-channel.runtime.repository'
import { decryptSecret } from '../../../../utils/encryption'

/* GET /api/admin/notifications/channels — list with masked config
   (webhook.txt §66; secrets never returned plaintext §44). */
export default defineEventHandler(async (event) => {
  await requirePermission(event, 'notifications.view')
  const rows = await listNotificationChannels()
  return {
    items: rows.map((row) => {
      let hint = row.configHint
      try {
        const config = JSON.parse(decryptSecret(JSON.parse(row.configEncrypted) as { ciphertext: string, nonce: string, authTag: string })) as Record<string, unknown>
        const url = String(config.url ?? '')
        hint = row.provider === 'spug'
          ? url.replace(/\/(xsend|send|sms|mail)\/.+$/, '/$1/••••')
          : url.replace(/(\/[^/]{8})[^/]*$/, '$1••••')
      } catch { /* decryption failure surfaces as stored hint */ }
      return {
        id: row.id,
        name: row.name,
        provider: row.provider,
        configHint: hint,
        enabled: row.enabled,
        createdAt: row.createdAt
      }
    })
  }
})
