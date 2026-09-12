import { createError } from 'h3'
import { requirePermission } from '../../../../utils/auth'
import { findGatewayById } from '../../../../repositories/gateway.repository'
import { testProviderConfig } from '../../../../modules/payments/provider-registry'

/** POST /api/admin/payment-gateways/:id/test — provider health check
    (credential probe, provider-specific). */
export default defineEventHandler(async (event) => {
  await requirePermission(event, 'store.payments.edit')
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid id' })
  }
  const gateway = await findGatewayById(id)
  if (!gateway) {
    throw createError({ statusCode: 404, statusMessage: 'Gateway not found' })
  }
  return testProviderConfig(gateway.providerKey, gateway.config ?? {}, gateway.mode)
})
