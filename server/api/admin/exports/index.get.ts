import { requirePermission } from '../../../utils/auth'
import { listExportJobs } from '../../../modules/exports/export.service'

/** GET /api/admin/exports — recent export jobs */
export default defineEventHandler(async (event) => {
  await requirePermission(event, 'store.exports.view')
  return { jobs: await listExportJobs() }
})
