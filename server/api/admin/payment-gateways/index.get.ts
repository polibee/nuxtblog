import { maskSecret } from '../../../utils/encryption'
import { listGateways } from '../../../repositories/gateway.repository'
import { requirePermission } from '../../../utils/auth'

/** GET /api/admin/payment-gateways — list with masked config values. */
export default defineEventHandler(async (event) => {
  await requirePermission(event, 'store.payments.view')
  const gateways = await listGateways()
  return gateways.map(g => ({
    ...g,
    config: g.config
      ? Object.fromEntries(Object.entries(g.config).map(([k, v]) => [k, maskSecret(v)]))
      : null,
    hasConfig: g.config !== null && Object.keys(g.config).length > 0
  }))
})
