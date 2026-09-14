import { requirePermission } from '../../../utils/auth'
import { cleanupTestData } from '../../../repositories/test-data-cleanup.repository'

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'settings.edit')
  if (process.env.DB_DRIVER && process.env.DB_DRIVER !== 'mysql') {
    throw createError({ statusCode: 409, statusMessage: 'Test data cleanup currently supports MySQL only' })
  }
  const body = await readBody<{ confirm?: boolean }>(event)
  if (body?.confirm !== true) {
    throw createError({ statusCode: 422, statusMessage: 'Explicit confirmation is required' })
  }
  return { cleaned: await cleanupTestData() }
})
