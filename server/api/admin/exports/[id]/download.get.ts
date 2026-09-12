import { createError } from 'h3'
import { requirePermission } from '../../../../utils/auth'
import { getExportJob, readExportFile } from '../../../../modules/exports/export.service'

/** GET /api/admin/exports/:id/download — stream the generated CSV. */
export default defineEventHandler(async (event) => {
  await requirePermission(event, 'store.exports.view')
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid id' })
  }
  const job = await getExportJob(id)
  if (!job) {
    throw createError({ statusCode: 404, statusMessage: 'Export job not found' })
  }
  if (job.status !== 'completed' || !job.fileKey) {
    throw createError({ statusCode: 409, statusMessage: `Export job is ${job.status}` })
  }
  const data = await readExportFile(job.fileKey)
  if (!data) {
    throw createError({ statusCode: 410, statusMessage: 'Export file is no longer available' })
  }
  const range = job.dateFrom && job.dateTo ? `_${job.dateFrom}_${job.dateTo}` : ''
  setResponseHeader(event, 'Content-Type', 'text/csv; charset=utf-8')
  setResponseHeader(event, 'Content-Disposition', `attachment; filename="${job.type}${range}_export_${job.id}.csv"`)
  return data
})
