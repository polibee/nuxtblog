import { requirePermission, getSessionUser } from '../../../utils/auth'
import { recordBackupJob } from '../../../modules/backup/backup.service'

/** POST /api/admin/backup — create a full-site backup ZIP, archive it in
    the exports storage and record the job. */
export default defineEventHandler(async (event) => {
  await requirePermission(event, 'backup.edit')
  const user = await getSessionUser(event)
  const { createBackup: create } = await import('../../../modules/backup/backup.service')
  const { fileName, zip, manifest } = await create({ includesMedia: true })
  const fileKey = `backups/${fileName}`
  await useStorage('exports').setItemRaw(fileKey, zip)
  const jobId = await recordBackupJob({
    fileKey,
    fileSize: zip.length,
    manifestVersion: manifest.version,
    includesMedia: manifest.includesMedia,
    createdBy: user?.id ?? null
  })
  return { job: { id: jobId, fileKey, fileName, fileSize: zip.length }, manifest }
})
