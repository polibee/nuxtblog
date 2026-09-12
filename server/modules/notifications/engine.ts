import { createHmac } from 'node:crypto'
import { isBlogDbReady } from '../../repositories/db.server'
import { findEnabledNotificationChannel, findNotificationChannel } from '../../repositories/notification-channel.runtime.repository'
import { claimPendingOutbox, findOutbox, findRecentOutbox, incrementOutboxSuppressed, insertOutbox, listPendingOutbox, markOutboxProcessed } from '../../repositories/notification-outbox.runtime.repository'
import { findDelivery, findDeliveryContext, insertDelivery, listDueDeliveries, listPendingDeliveries, updateDelivery } from '../../repositories/notification-delivery.runtime.repository'
import { listEnabledSubscriptions, listMatchedSubscriptionIds } from '../../repositories/notification-subscription.runtime.repository'
import { decryptSecret } from '../../utils/encryption'
import { resolveSafeWebhookUrl, signPayload } from '../../utils/webhook'
import { getEvent, severityAtLeast, type EventSeverity } from './event-registry'

/* P38 Notification Engine (docs/webhook.txt §44-53/72-73): outbox
   pattern — business events append rows inside (or right after) their
   transaction; the worker (scheduler tick) matches subscriptions,
   delivers via the channel adapter and applies the retry policy.
   HTTP failures NEVER break business operations. */

const RETRY_DELAYS_MIN = [1, 5, 30, 120]
const MAX_ATTEMPTS = 5
const DEDUP_WINDOW_MS = 5 * 60_000
const FIRE_TIMEOUT_MS = 10_000

export interface NotificationEventPayload {
  module: string
  severity: EventSeverity
  entityType?: string
  entityId?: string
  data: Record<string, unknown>
}

/* ---------------- outbox (§45/50) ---------------- */

export async function appendOutbox(eventName: string, payload: NotificationEventPayload): Promise<void> {
  if (!isBlogDbReady()) return
  const def = getEvent(eventName)
  if (!def) return /* unregistered events are not notifiable (§74) */

  const dedupeKey = payload.severity === 'error' || payload.severity === 'critical'
    ? `${eventName}:${payload.entityId ?? ''}`
    : null
  if (dedupeKey) {
    const since = new Date(Date.now() - DEDUP_WINDOW_MS)
    const recent = await findRecentOutbox(dedupeKey, since)
    if (recent) {
      await incrementOutboxSuppressed(recent.id, recent.suppressedCount + 1)
      return
    }
  }

  await insertOutbox({
    eventName,
    module: def.module,
    severity: payload.severity,
    entityType: payload.entityType ?? null,
    entityId: payload.entityId ?? null,
    payloadJson: JSON.stringify({ ...payload.data, event: eventName, severity: payload.severity, occurredAt: new Date().toISOString() }),
    dedupeKey
  })
}

/* ---------------- channel adapters (§6/8/9/34) ---------------- */

interface ChannelConfig {
  url: string
  secret?: string
  headers?: Record<string, string>
  format?: 'text' | 'card'
}

function decryptConfig(channel: { configEncrypted: string }): ChannelConfig {
  const parsed = JSON.parse(channel.configEncrypted) as { ciphertext: string, nonce: string, authTag: string }
  return JSON.parse(String(decryptSecret(parsed))) as ChannelConfig
}

interface SendResult {
  ok: boolean
  status: number | null
  summary: string
  retryable: boolean
}

function renderSummary(eventName: string, data: Record<string, unknown>): string {
  const entity = (data.post ?? data.page ?? data.comment ?? data.order ?? {}) as Record<string, unknown>
  const title = String(entity.title ?? entity.name ?? data.summary ?? '')
  return title ? `${title}` : eventName
}

async function sendWebhook(config: ChannelConfig, eventName: string, payload: Record<string, unknown>): Promise<SendResult> {
  const target = await resolveSafeWebhookUrl(config.url)
  const body = JSON.stringify({ version: '1', id: `evt_${Date.now()}`, event: eventName, timestamp: new Date().toISOString(), data: payload })
  const headers: Record<string, string> = { 'content-type': 'application/json', 'x-webhook-event': eventName }
  if (config.secret) {
    headers['x-webhook-signature'] = signPayload(config.secret, body)
  }
  for (const [k, v] of Object.entries(config.headers ?? {})) headers[k] = v
  const response = await fetch(target, { method: 'POST', body, headers, signal: AbortSignal.timeout(FIRE_TIMEOUT_MS) })
  await response.arrayBuffer().catch(() => undefined)
  const ok = response.status >= 200 && response.status < 400
  return { ok, status: response.status, summary: `HTTP ${response.status}`, retryable: !ok && (response.status === 429 || response.status >= 500) }
}

async function postJson(url: string, body: Record<string, unknown>, provider: string | null = null): Promise<SendResult> {
  const target = await resolveSafeWebhookUrl(url)
  const response = await fetch(target, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(FIRE_TIMEOUT_MS)
  })
  const text = (await response.text().catch(() => '')).slice(0, 300)
  const httpOk = response.status >= 200 && response.status < 400
  let ok = httpOk
  /* Feishu replies HTTP 200 with {code:19021} on sign/format errors and
     Spug replies {code:200} on success — HTTP status alone lies */
  if (httpOk && provider === 'lark') {
    try {
      ok = (JSON.parse(text) as { code?: number }).code === 0
    } catch { /* non-JSON reply — trust HTTP status */ }
  }
  if (httpOk && provider === 'spug') {
    try {
      ok = (JSON.parse(text) as { code?: number }).code === 200
    } catch { /* non-JSON reply — trust HTTP status */ }
  }
  const retryable = !ok && !httpOk && (response.status === 429 || response.status >= 500)
  return { ok, status: response.status, summary: text || `HTTP ${response.status}`, retryable }
}

/* Lark interactive card (webhook.txt §8) */
async function sendLark(config: ChannelConfig, eventName: string, data: Record<string, unknown>): Promise<SendResult> {
  const summary = renderSummary(eventName, data)
  const title = `🔔 ${eventName}`
  const content = String(data.summary ?? summary).slice(0, 800)
  const payload = config.format === 'text'
    ? { msg_type: 'text', content: { text: `${title}\n${content}` } }
    : {
        msg_type: 'interactive',
        card: {
          elements: [{ tag: 'div', text: { tag: 'lark_md', content } }],
          header: { title: { tag: 'plain_text', content: title } }
        }
      }
  if (config.secret) {
    // Feishu custom-bot signature: key = timestamp + LF + secret
    const timestamp = Math.floor(Date.now() / 1000).toString()
    const sign = createHmac('sha256', timestamp + '\n' + config.secret).update('').digest('base64')
    return postJson(config.url, { timestamp, sign, ...payload }, 'lark')
  }
  return postJson(config.url, payload, 'lark')
}

/* Spug push (spug20260810.txt): the channel URL already embeds the
   credential — /send/<TEMPLATE_CODE> or /xsend/<TOKEN> (§9) */
async function sendSpug(config: ChannelConfig, eventName: string, data: Record<string, unknown>): Promise<SendResult> {
  const summary = renderSummary(eventName, data)
  return postJson(config.url, {
    title: eventName.slice(0, 32),
    content: String(data.summary ?? summary).slice(0, 1000)
  }, 'spug')
}

async function sendViaProvider(provider: string, config: ChannelConfig, eventName: string, data: Record<string, unknown>): Promise<SendResult> {
  if (provider === 'lark') return sendLark(config, eventName, data)
  if (provider === 'spug') return sendSpug(config, eventName, data)
  return sendWebhook(config, eventName, data)
}

/* ---------------- worker (§44/47/48/73) ---------------- */

export async function processNotificationOutbox(): Promise<{ processed: number, deliveries: number }> {
  if (!isBlogDbReady()) return { processed: 0, deliveries: 0 }
  if (String(await getSetting('notifications.enabled', 'true')) === 'false') {
    return { processed: 0, deliveries: 0 }
  }
  /* retry pass: due failed deliveries */
  const dueRetries = await listDueDeliveries(new Date())
  for (const row of dueRetries) {
    await deliverOne(row.id)
  }

  /* main pass: claim pending outbox rows */
  const pending = await listPendingOutbox()
  let processed = 0
  let deliveries = 0
  for (const row of pending) {
    if (!await claimPendingOutbox(row.id)) continue
    const count = await dispatchOutbox(row.id)
    processed++
    deliveries += count
  }
  return { processed, deliveries }
}

async function getSetting(key: string, fallback: string): Promise<string> {
  const { getSettingValue } = await import('../settings/settings.service')
  return String(await getSettingValue(key, fallback))
}

async function dispatchOutbox(outboxId: number): Promise<number> {
  const row = await findOutbox(outboxId)
  if (!row) return 0
  /* §25/61: subscription matching */
  const subs = await listEnabledSubscriptions()
  const subIds = subs.map(s => s.id)
  const matched = await listMatchedSubscriptionIds(subIds, row.eventName)
  const matchedIds = new Set(matched.map(m => m.subscriptionId))

  const targets = subs.filter(s => matchedIds.has(s.id) && severityAtLeast(row.severity, s.minimumSeverity))
  let count = 0
  for (const sub of targets) {
    const channel = await findEnabledNotificationChannel(sub.channelId)
    if (!channel) continue
    await insertDelivery({
      outboxId,
      subscriptionId: sub.id,
      channelId: channel.id,
      provider: channel.provider
    })
    count++
  }

  /* fire pending deliveries for this outbox row immediately */
  const queued = await listPendingDeliveries(outboxId)
  for (const d of queued) {
    await deliverOne(d.id)
  }

  await markOutboxProcessed(outboxId)
  return count
}

export async function deliverOne(deliveryId: number): Promise<void> {
  const delivery = await findDelivery(deliveryId)
  if (!delivery) return
  const { channel, outbox } = await findDeliveryContext(delivery)
  if (!channel || !outbox) {
    await updateDelivery(deliveryId, { status: 'dead', lastError: 'channel or event removed' })
    return
  }

  let config: ChannelConfig
  try {
    config = decryptConfig(channel)
  } catch {
    await updateDelivery(deliveryId, { status: 'failed', lastError: 'channel config unavailable' })
    return
  }

  const data = JSON.parse(outbox.payloadJson) as Record<string, unknown>
  let result: { ok: boolean, status: number | null, summary: string, retryable: boolean }
  try {
    result = await sendViaProvider(channel.provider, config, outbox.eventName, data)
  } catch (e) {
    const message = (e as Error).message || 'delivery error'
    result = { ok: false, status: null, summary: message, retryable: true }
  }

  const attempt = delivery.attemptCount + 1
  if (result.ok) {
    await updateDelivery(deliveryId, {
      status: 'success',
      attemptCount: attempt,
      responseStatus: result.status,
      responseSummary: result.summary.slice(0, 500),
      sentAt: new Date(),
      lastError: null
    })
    return
  }

  /* §48: only timeout/429/5xx/network retry — config errors die */
  if (result.retryable && attempt < MAX_ATTEMPTS) {
    const delayMin = RETRY_DELAYS_MIN[Math.min(attempt - 1, RETRY_DELAYS_MIN.length - 1)] ?? 120
    await updateDelivery(deliveryId, {
      status: 'failed',
      attemptCount: attempt,
      responseStatus: result.status,
      lastError: result.summary.slice(0, 500),
      nextRetryAt: new Date(Date.now() + delayMin * 60_000)
    })
    return
  }
  await updateDelivery(deliveryId, {
    status: 'dead',
    attemptCount: attempt,
    responseStatus: result.status,
    lastError: result.summary.slice(0, 500)
  })
}

/* ---------------- bus hook: CMS events → outbox ---------------- */

export async function enqueueFromCmsEvent(event: string, payload: Record<string, unknown>): Promise<void> {
  const { mapCmsEvent } = await import('./event-registry')
  const mapped = await mapCmsEvent(event, payload)
  if (!mapped) return
  const record = (payload.record ?? {}) as Record<string, unknown>
  const id = payload.id ?? record.id
  const title = record.title ?? record.name ?? ''
  await appendOutbox(mapped.name, {
    module: mapped.module,
    severity: getEvent(mapped.name)?.severity ?? 'info',
    entityType: String(payload.resource ?? ''),
    entityId: id ? String(id) : undefined,
    data: {
      'post.title': title, 'page.title': title,
      'summary': title ? String(title) : event,
      'entityId': id ? String(id) : ''
    }
  })
}

/* ---------------- test helpers ---------------- */

export async function testChannel(channelId: number): Promise<{ ok: boolean, summary: string }> {
  const channel = await findNotificationChannel(channelId)
  if (!channel) return { ok: false, summary: 'channel not found' }
  let config: ChannelConfig
  try {
    config = decryptConfig(channel)
  } catch {
    return { ok: false, summary: 'config unavailable' }
  }
  const result = await sendViaProvider(channel.provider, config, 'test.notification', {
    summary: 'Test notification from your site — the channel is configured correctly.'
  })
  return { ok: result.ok, summary: result.summary }
}
