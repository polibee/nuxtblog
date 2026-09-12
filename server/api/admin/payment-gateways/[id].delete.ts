import { createError } from 'h3'
import { requirePermission } from '../../../utils/auth'
import { deleteGateway, findGatewayById } from '../../../repositories/gateway.repository'

/** DELETE /api/admin/payment-gateways/:id — remove a gateway instance.
    Payment attempts/transactions keep their gateway_key snapshot. */
export default defineEventHandler(async (event) => {
  await requirePermission(event, 'store.payments.edit')
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid id' })
  }
  const existing = await findGatewayById(id)
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Gateway not found' })
  }
  await deleteGateway(id)
  return { ok: true }
})
