import { requestJson } from './drivers/shared'
import { getDriver, knownProviders } from './gateway-manager'

/* Provider templates drive the admin gateway UI: which config fields a
   channel needs, what it can do, and how to health-check it. Adding a
   new channel = new driver + entry here. */

export interface ProviderFieldTemplate {
  key: string
  label: string
  required: boolean
  /** stored encrypted; rendered as a password input and masked on read */
  secret: boolean
  placeholder?: string
  help?: string
}

export interface ProviderTemplate {
  providerKey: string
  name: string
  description: string
  capabilities: string[]
  fields: ProviderFieldTemplate[]
  docsUrl?: string
  /** merchant signup link shown as a button in the gateway admin UI */
  signupUrl?: string
}

export const PROVIDER_TEMPLATES: ProviderTemplate[] = [
  {
    providerKey: 'mock',
    name: 'Mock',
    description: 'Built-in mock driver for development and testing. Instantly approves payments.',
    capabilities: ['create', 'capture', 'refund', 'webhook', 'sandbox'],
    fields: []
  },
  {
    providerKey: 'paypal',
    name: 'PayPal',
    description: 'PayPal Checkout Orders v2 with hosted approval and webhooks.',
    capabilities: ['create', 'capture', 'refund', 'webhook', 'redirect', 'multi_currency', 'sandbox'],
    docsUrl: 'https://developer.paypal.com/docs/checkout/',
    signupUrl: 'https://www.paypal.com/',
    fields: [
      { key: 'clientId', label: 'Client ID', required: true, secret: false },
      { key: 'clientSecret', label: 'Client Secret', required: true, secret: true },
      { key: 'webhookId', label: 'Webhook ID', required: true, secret: false, help: 'From the PayPal developer dashboard webhook subscription' }
    ]
  },
  {
    providerKey: 'creem',
    name: 'Creem',
    description: 'Merchant-of-Record hosted checkout. Refunds are handled in the Creem dashboard and arrive via webhook.',
    capabilities: ['create', 'capture', 'webhook', 'redirect', 'sandbox'],
    docsUrl: 'https://docs.creem.io',
    signupUrl: 'https://www.creem.io/signup',
    fields: [
      { key: 'apiKey', label: 'API Key (x-api-key)', required: true, secret: true },
      { key: 'productId', label: 'Product ID', required: true, secret: false, help: 'Creem product id, e.g. prod_xxx' },
      { key: 'webhookSecret', label: 'Webhook Secret', required: true, secret: true }
    ]
  },
  {
    providerKey: 'lemonsqueezy',
    name: 'Lemon Squeezy',
    description: 'Merchant-of-Record checkout with custom price. Refunds are handled in the dashboard and arrive via webhook.',
    capabilities: ['create', 'capture', 'webhook', 'redirect', 'sandbox'],
    docsUrl: 'https://docs.lemonsqueezy.com/api',
    signupUrl: 'https://app.lemonsqueezy.com/register',
    fields: [
      { key: 'apiKey', label: 'API Key', required: true, secret: true },
      { key: 'storeId', label: 'Store ID', required: true, secret: false },
      { key: 'variantId', label: 'Variant ID', required: true, secret: false, help: 'Variant used as the checkout price anchor' },
      { key: 'webhookSecret', label: 'Signing Secret', required: true, secret: true }
    ]
  },
  {
    providerKey: 'nowpayments',
    name: 'NOWPayments',
    description: 'Crypto payments with fiat-priced invoices and IPN callbacks.',
    capabilities: ['create', 'capture', 'webhook', 'redirect', 'sandbox'],
    docsUrl: 'https://documenter.getpostman.com/view/7907941/S1a32n38',
    signupUrl: 'https://account.nowpayments.io/create-account?link_id=3940543227',
    fields: [
      { key: 'apiKey', label: 'API Key', required: true, secret: true },
      { key: 'ipnSecret', label: 'IPN Secret', required: true, secret: true }
    ]
  },
  {
    providerKey: 'xcash',
    name: 'Xcash',
    description: 'Crypto invoice gateway with HMAC-signed API and public status polling.',
    capabilities: ['create', 'capture', 'webhook', 'redirect'],
    docsUrl: 'https://pay.xca.sh',
    signupUrl: 'https://dash.xca.sh/register?ref=2GWV5MKT',
    fields: [
      { key: 'appid', label: 'AppID', required: true, secret: false, placeholder: 'XC-XXXXXXXX' },
      { key: 'hmacKey', label: 'HMAC Key', required: true, secret: true }
    ]
  },
  {
    providerKey: 'waffo',
    name: 'Waffo',
    description: 'Global payment platform (cards, e-wallets, virtual accounts) via the official SDK.',
    capabilities: ['create', 'capture', 'refund', 'webhook', 'redirect', 'sandbox'],
    docsUrl: 'https://docs.waffo.com',
    signupUrl: 'https://www.waffo.com/',
    fields: [
      { key: 'apiKey', label: 'API Key', required: true, secret: true },
      { key: 'merchantId', label: 'Merchant ID', required: true, secret: false },
      { key: 'privateKey', label: 'Merchant Private Key (base64 PKCS8)', required: true, secret: true },
      { key: 'waffoPublicKey', label: 'Waffo Public Key (base64)', required: true, secret: false }
    ]
  }
]

export function findProviderTemplate(providerKey: string): ProviderTemplate | undefined {
  return PROVIDER_TEMPLATES.find(t => t.providerKey === providerKey)
}

/** validate required fields exist and the provider has a driver */
export function validateProviderConfig(providerKey: string, config: Record<string, string> | null): { ok: boolean, message: string } {
  if (!knownProviders().includes(providerKey)) {
    return { ok: false, message: `Unknown provider: ${providerKey}` }
  }
  const template = findProviderTemplate(providerKey)
  if (!template) return { ok: false, message: `No template for provider ${providerKey}` }
  for (const field of template.fields.filter(f => f.required)) {
    const value = config?.[field.key]?.trim()
    if (!value) return { ok: false, message: `Missing required config: ${field.label}` }
  }
  return { ok: true, message: 'ok' }
}

/** health check used by POST /api/admin/payment-gateways/:id/test */
export async function testProviderConfig(providerKey: string, config: Record<string, string>, mode: string): Promise<{ ok: boolean, message: string }> {
  const presence = validateProviderConfig(providerKey, config)
  if (!presence.ok) return presence
  const template = findProviderTemplate(providerKey)
  if (template && template.fields.length === 0) {
    return { ok: true, message: 'Provider is always available' }
  }
  try {
    switch (providerKey) {
      case 'paypal': {
        await getDriver(providerKey).getPaymentStatus({
          providerOrderId: 'healthcheck-nonexistent',
          config, mode: mode === 'live' ? 'live' : 'sandbox'
        })
        return { ok: true, message: 'Credentials accepted by PayPal' }
      }
      case 'creem': {
        // a 404 on an unknown checkout means auth passed; 401 means bad key
        try {
          await requestJson({ method: 'GET', url: `${mode === 'live' ? 'https://api.creem.io' : 'https://test-api.creem.io'}/v1/checkouts/healthcheck-nonexistent`, headers: { 'x-api-key': config.apiKey ?? '' } })
          return { ok: true, message: 'API key accepted by Creem' }
        } catch (error) {
          if ((error as Error & { statusCode?: number }).statusCode === 404) {
            return { ok: true, message: 'API key accepted by Creem' }
          }
          throw error
        }
      }
      case 'lemonsqueezy': {
        await requestJson({
          method: 'GET',
          url: 'https://api.lemonsqueezy.com/v1/user',
          headers: { Authorization: `Bearer ${config.apiKey ?? ''}`, Accept: 'application/vnd.api+json' }
        })
        return { ok: true, message: 'API key accepted by Lemon Squeezy' }
      }
      case 'nowpayments': {
        const status = await requestJson<{ isAvailable?: boolean }>({ method: 'GET', url: `${(config.NOWPAYMENTS_BASE_URL ?? 'https://api.nowpayments.io/v1').replace(/\/$/, '')}/status` })
        return { ok: status.isAvailable !== false, message: status.isAvailable === false ? 'NOWPayments API is unavailable' : 'API reachable' }
      }
      case 'waffo': {
        const { Waffo, Environment } = await import('@waffo/waffo-node')
        const client = new Waffo({
          apiKey: config.apiKey ?? '',
          privateKey: config.privateKey ?? '',
          waffoPublicKey: config.waffoPublicKey ?? '',
          merchantId: config.merchantId ?? '',
          environment: mode === 'live' ? Environment.PRODUCTION : Environment.SANDBOX
        })
        const response = await client.merchantConfig().inquiry({})
        return response.isSuccess()
          ? { ok: true, message: 'Credentials accepted by Waffo' }
          : { ok: false, message: `Waffo rejected credentials: ${response.getMessage()}` }
      }
      default:
        return { ok: true, message: 'Config looks valid (no remote health check for this provider)' }
    }
  } catch (error) {
    const driver = getDriver(providerKey)
    const normalized = driver.normalizeError(error)
    return { ok: false, message: `${normalized.code}: ${normalized.message}` }
  }
}
