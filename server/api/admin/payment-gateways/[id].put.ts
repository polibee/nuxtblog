import { createError } from 'h3'
import { requirePermission } from '../../../utils/auth'
import { findGatewayById, updateGateway } from '../../../repositories/gateway.repository'
import { validateProviderConfig } from '../../../modules/payments/provider-registry'

/** PUT /api/admin/payment-gateways/:id — update. Masked config values
    (containing ••••) or empty strings keep the stored encrypted value. */
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
  const body = await readBody(event) as {
    displayName?: string
    enabled?: boolean
    mode?: string
    sortOrder?: number
    enabledCurrencies?: string | null
    config?: Record<string, string> | null
  } | null

  const patch: Parameters<typeof updateGateway>[1] = {}
  if (body?.displayName !== undefined && body.displayName.trim()) patch.displayName = body.displayName.trim()
  if (body?.enabled !== undefined) patch.enabled = body.enabled
  if (body?.mode !== undefined) patch.mode = body.mode === 'live' ? 'live' : 'sandbox'
  if (body?.sortOrder !== undefined) patch.sortOrder = Number(body.sortOrder) || 0
  if (body?.enabledCurrencies !== undefined) patch.enabledCurrencies = body.enabledCurrencies?.trim() || null
  if (body?.config !== undefined) {
    if (body.config === null) {
      patch.config = null
    } else {
      const merged: Record<string, string> = {}
      for (const [k, raw] of Object.entries(body.config)) {
        const value = String(raw)
        if (!value || value.includes('••••')) {
          if (existing.config?.[k] !== undefined) merged[k] = existing.config[k]
        } else {
          merged[k] = value
        }
      }
      patch.config = Object.keys(merged).length > 0 ? merged : null
    }
  }
  const enabling = patch.enabled === true || (patch.enabled === undefined && existing.enabled)
  if (enabling) {
    const validation = validateProviderConfig(existing.providerKey, patch.config !== undefined ? patch.config ?? {} : existing.config ?? {})
    if (!validation.ok) {
      throw createError({ statusCode: 400, statusMessage: `Cannot enable gateway: ${validation.message}` })
    }
  }
  await updateGateway(id, patch)
  return { ok: true }
})
