import { requirePermission } from '../../../utils/auth'
import { getTestDataCounts } from '../../../repositories/test-data-cleanup.repository'

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'settings.view')
  if (process.env.DB_DRIVER && process.env.DB_DRIVER !== 'mysql') {
    throw createError({ statusCode: 409, statusMessage: 'Test data cleanup currently supports MySQL only' })
  }
  return { counts: await getTestDataCounts() }
})
