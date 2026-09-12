import { createError } from 'h3'
import { requirePermission } from '../../../../utils/auth'
import { createPlan } from '../../../../modules/membership/membership.service'
import { aliasSchema } from '#shared/schemas/post'

/** POST /api/admin/membership/plans — create a membership plan (admin) */
export default defineEventHandler(async (event) => {
  await requirePermission(event, 'store.membership.create')
  const body = await readBody(event) as {
    alias?: string
    name?: string
    priceMinor?: number
    currency?: string
    period?: string
    status?: string
  } | null
  const alias = body?.alias?.trim() ?? ''
  const name = body?.name?.trim() ?? ''
  const priceMinor = Number(body?.priceMinor)
  if (!aliasSchema.safeParse(alias).success) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid alias' })
  }
  if (!name) {
    throw createError({ statusCode: 400, statusMessage: 'name is required' })
  }
  if (!Number.isInteger(priceMinor) || priceMinor <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'priceMinor must be a positive integer' })
  }
  const currency = ['USD', 'CNY', 'EUR'].includes(body?.currency ?? '') ? body!.currency! : 'USD'
  const period = ['month', 'year'].includes(body?.period ?? '') ? body!.period! : 'month'
  const id = await createPlan({
    alias,
    name,
    priceMinor,
    currency,
    period,
    status: body?.status === 'draft' ? 'draft' : 'published'
  })
  return { id }
})
