import { getCollection, listCollectionNames } from '../utils/db'
import { emitCmsEvent } from '../utils/events'
import { processRetryQueue } from '../utils/webhook'
import { promoteScheduledPosts } from '../modules/posts/post.service'
import { isBlogDbReady } from '../repositories/db.server'

/**
 * Lazy scheduler: promotes scheduled content (demo ct_* collections and
 * real posts) to published and drains the webhook retry queue. Runs
 * every 15s - sufficient for demo scale; swap with a queue/cron
 * (e.g. Nitro scheduled tasks or a worker) for production.
 */
export default defineNitroPlugin(() => {
  const tick = async (): Promise<void> => {
    try {
      const now = Date.now()
      for (const name of listCollectionNames()) {
        if (!name.startsWith('ct_')) continue
        for (const row of getCollection(name)) {
          if (
            row.status === 'scheduled'
            && typeof row.scheduledAt === 'string'
            && new Date(row.scheduledAt).getTime() <= now
          ) {
            row.status = 'published'
            row.publishedAt = new Date().toISOString()
            await emitCmsEvent('content.published', { resource: name, record: row })
          }
        }
      }

      if (isBlogDbReady()) {
        const promoted = await promoteScheduledPosts()
        if (promoted > 0) {
          console.log(`[scheduler] promoted ${promoted} scheduled posts`)
        }
      }

      await processRetryQueue()
      await friendLinksTick(now)
      await notificationsTick()
    } catch {
      // scheduler must never crash the server
    }
  }

  setInterval(tick, 15_000)
})

/* P37 friend links health pass (docs/友链.txt §51-53): every 24h with
   concurrency 5 inside runScheduledChecks; one missed backlink only
   bumps the failure counter — never auto-removal. */
let lastFriendLinksRun = 0
async function friendLinksTick(now: number): Promise<void> {
  if (now - lastFriendLinksRun < 24 * 3600_000) return
  lastFriendLinksRun = now
  try {
    const { runScheduledChecks } = await import('../modules/friend-links/friend-links.service')
    const result = await runScheduledChecks()
    if (result.checked > 0) {
      console.log(`[scheduler] friend-link checks: ${result.checked} checked, ${result.missing} missing backlink`)
    }
  } catch (e) {
    console.error('[scheduler] friend-link checks failed:', (e as Error).message)
  }
}

/* P38 notification worker (webhook.txt 73): DB-backed queue drained
   on every 15s tick. */
async function notificationsTick(): Promise<void> {
  try {
    const { processNotificationOutbox } = await import('../modules/notifications/engine')
    const result = await processNotificationOutbox()
    if (result.processed > 0) {
      console.log('[scheduler] notifications:', result.processed, 'events,', result.deliveries, 'deliveries')
    }
  } catch (e) {
    console.error('[scheduler] notification worker failed:', (e as Error).message)
  }
}
