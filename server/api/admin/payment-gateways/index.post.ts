import { createError } from 'h3'
import { requirePermission } from '../../../utils/auth'
import { insertGateway } from '../../../repositories/gateway.repository'
import { validateProviderConfig } from '../../../modules/payments/provider-registry'

const KEY_PATTERN = /^[a-z][a-z0-9-]{1,38}$/

/** POST /api/admin/payment-gateways — create a gateway (config encrypted). */
export default defineEventHandler(async (event) => {
  await requirePermission(event, 'store.payments.edit')
  const body = await readBody(event) as {
    key?: string
    providerKey?: string
    displayName?: string
    enabled?: boolean
    mode?: string
    sortOrder?: number
    enabledCurrencies?: string | null
    config?: Record<string, string> | null
  } | null

  const key = body?.key?.trim() ?? ''
  const providerKey = body?.providerKey?.trim() ?? ''
  const displayName = body?.displayName?.trim() ?? ''
  if (!KEY_PATTERN.test(key)) {
    throw createError({ statusCode: 400, statusMessage: 'key must be a lowercase slug (2-39 chars)' })
  }
  if (!displayName) {
    throw createError({ statusCode: 400, statusMessage: 'displayName is required' })
  }
  const config = body?.config && Object.keys(body.config).length > 0
    ? Object.fromEntries(Object.entries(body.config).map(([k, v]) => [k, String(v)]))
    : null
  const validation = validateProviderConfig(providerKey, config)
  if (!validation.ok) {
    throw createError({ statusCode: 400, statusMessage: validation.message })
  }

  const id = await insertGateway({
    key,
    providerKey,
    displayName,
    enabled: body?.enabled ?? false,
    mode: body?.mode === 'live' ? 'live' : 'sandbox',
    sortOrder: Number.isInteger(body?.sortOrder) ? Number(body!.sortOrder) : 0,
    enabledCurrencies: body?.enabledCurrencies?.trim() || null,
    config
  })
  return { id }
})
