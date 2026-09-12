import { dispatchWebhooks } from './webhook'

/* =============================================================
 * Server-side event bus - the hook point for plugins & webhooks.
 * Events follow content lifecycle naming:
 *   content.beforeCreate / content.afterCreate
 *   content.beforeUpdate / content.afterUpdate
 *   content.beforeDelete / content.afterDelete
 *   content.published / content.unpublished / content.restored
 * Payload: { resource, record?, id?, patch? }
 * before* handlers may throw to veto the operation.
 * ============================================================= */

type CmsHandler = (payload: Record<string, unknown>) => Promise<void> | void

const handlers = new Map<string, Set<CmsHandler>>()

export function onCmsEvent(event: string, handler: CmsHandler): () => void {
  if (!handlers.has(event)) handlers.set(event, new Set())
  handlers.get(event)!.add(handler)
  return () => handlers.get(event)?.delete(handler)
}

export function offCmsEvent(event: string, handler: CmsHandler): void {
  handlers.get(event)?.delete(handler)
}

export async function emitCmsEvent(event: string, payload: Record<string, unknown>): Promise<void> {
  for (const handler of [...handlers.get(event) ?? []]) {
    await handler(payload)
  }
  // outbound webhooks subscribe to the same event names
  await dispatchWebhooks(event, payload).catch(() => undefined)
  // P38 notification center: notifiable events land in the outbox;
  // failures here must never break the business operation
  try {
    const { enqueueFromCmsEvent } = await import('../modules/notifications/engine')
    await enqueueFromCmsEvent(event, payload)
  } catch {
    // notification outbox is best-effort
  }
}
