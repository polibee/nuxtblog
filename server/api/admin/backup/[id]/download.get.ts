import { eq } from 'drizzle-orm'
import { requirePermission } from '../../../../utils/auth'
import { getDb } from '../../../../repositories/db.server'
import { backupJobs } from '../../../../repositories/schema/backup'

/** GET /api/admin/backup/:id/download — stream the archived ZIP */
export default defineEventHandler(async (event) => {
  await requirePermission(event, 'backup.view')
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid id' })
  }
  const [job] = await getDb().select().from(backupJobs).where(eq(backupJobs.id, id)).limit(1)
  if (!job?.fileKey) {
    throw createError({ statusCode: 404, statusMessage: 'Backup not found' })
  }
  const data = await useStorage('exports').getItemRaw(job.fileKey)
  if (!data) {
    throw createError({ statusCode: 404, statusMessage: 'Backup archive missing from storage' })
  }
  setResponseHeader(event, 'Content-Type', 'application/zip')
  setResponseHeader(event, 'Content-Disposition', `attachment; filename="${job.fileKey.split('/').pop() ?? 'backup.zip'}"`)
  return data
})
