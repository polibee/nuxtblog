import { requirePermission } from '../../../utils/auth'
import { restoreBackup } from '../../../modules/backup/backup.service'

/** POST /api/admin/backup/restore — Replace-mode restore (§13).
    Requires the confirmation word RESTORE (§21). */
export default defineEventHandler(async (event) => {
  await requirePermission(event, 'backup.edit')
  const parts = await readMultipartFormData(event)
  const file = parts?.find(p => p.name === 'file')
  const confirm = parts?.find(p => p.name === 'confirm')?.data.toString('utf-8') ?? ''
  if (!file) {
    throw createError({ statusCode: 422, statusMessage: 'Multipart field "file" is required' })
  }
  try {
    const result = await restoreBackup(file.data, { confirm })
    return { ok: true, restored: result.restored }
  } catch (e) {
    const err = e as Error & { statusCode?: number }
    throw createError({ statusCode: err.statusCode ?? 422, statusMessage: err.message })
  }
})
