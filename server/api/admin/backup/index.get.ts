import { requirePermission } from '../../../utils/auth'
import { listBackupJobs } from '../../../modules/backup/backup.service'

/** GET /api/admin/backup — backup job history */
export default defineEventHandler(async (event) => {
  await requirePermission(event, 'backup.view')
  return { jobs: await listBackupJobs() }
})
