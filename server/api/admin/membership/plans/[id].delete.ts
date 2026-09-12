import { eq } from 'drizzle-orm'
import { createError } from 'h3'
import { requirePermission } from '../../../../utils/auth'
import { getDb } from '../../../../repositories/db.server'
import { membershipPlans } from '../../../../repositories/schema/membership'
import { deletePlan } from '../../../../modules/membership/membership.service'

/** DELETE /api/admin/membership/plans/:id — remove a plan */
export default defineEventHandler(async (event) => {
  await requirePermission(event, 'store.membership.create')
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid id' })
  }
  const [row] = await getDb().select().from(membershipPlans).where(eq(membershipPlans.id, id)).limit(1)
  if (!row) {
    throw createError({ statusCode: 404, statusMessage: 'Plan not found' })
  }
  await deletePlan(id)
  return { ok: true }
})
