import { createError } from 'h3'
import { requirePermission } from '../../../utils/auth'
import { createExportJob, EXPORT_TYPES, type ExportType } from '../../../modules/exports/export.service'

/** POST /api/admin/exports — create a CSV export job (commerce doc §11.3). */
export default defineEventHandler(async (event) => {
  const user = await requirePermission(event, 'store.exports.create')
  const body = await readBody(event) as {
    type?: string
    dateFrom?: string | null
    dateTo?: string | null
  } | null

  const type = body?.type?.trim() ?? ''
  if (!EXPORT_TYPES.includes(type as never)) {
    throw createError({ statusCode: 400, statusMessage: `type must be one of: ${EXPORT_TYPES.join(', ')}` })
  }
  const dateRe = /^\d{4}-\d{2}-\d{2}$/
  const dateFrom = body?.dateFrom && dateRe.test(body.dateFrom) ? body.dateFrom : null
  const dateTo = body?.dateTo && dateRe.test(body.dateTo) ? body.dateTo : null
  if ((dateFrom && !dateTo) || (!dateFrom && dateTo)) {
    throw createError({ statusCode: 400, statusMessage: 'dateFrom and dateTo must be provided together' })
  }

  const job = await createExportJob(type as ExportType, dateFrom, dateTo, user.id)
  return { job }
})
