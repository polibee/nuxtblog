import { handleWebhook } from '../../../../modules/payments/gateway-manager'

/** POST /api/public/payments/:gateway/webhook — raw-body webhook endpoint.
    Verifies the signature first, stores the event idempotently, then
    dispatches state changes. Failures return 5xx so providers retry. */
export default defineEventHandler(async (event) => {
  const gatewayKey = getRouterParam(event, 'gateway') ?? ''
  const body = await readRawBody(event, 'utf8')
  if (!body) {
    throw createError({ statusCode: 400, statusMessage: 'Empty webhook body' })
  }
  return handleWebhook(gatewayKey, getHeaders(event) as Record<string, string>, body)
})
