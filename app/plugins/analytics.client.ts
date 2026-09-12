/* Client-side analytics tracking (architecture §11.3).
   Sends page_view events on SSR hydration + SPA route changes via
   navigator.sendBeacon (fallback: fetch keepalive). Filters admin,
   api and preview paths. Respects DNT. */

interface AnalyticsIds {
  visitorId: string
  sessionId: string
  eventSeq: number
  lastPath: string | null
  lastSend: number
}

const SESSION_WINDOW_MS = 30 * 60 * 1000

let state: AnalyticsIds | null = null

function getOrCreateIds(): AnalyticsIds {
  if (state) return state

  let visitorId = localStorage.getItem('analytics_vid')
  if (!visitorId) {
    visitorId = crypto.randomUUID()
    localStorage.setItem('analytics_vid', visitorId)
  }

  let sessionId = sessionStorage.getItem('analytics_sid')
  const sessionTs = Number(sessionStorage.getItem('analytics_ts') ?? '0')
  const now = Date.now()

  if (!sessionId || now - sessionTs > SESSION_WINDOW_MS) {
    sessionId = crypto.randomUUID()
  }
  sessionStorage.setItem('analytics_sid', sessionId)
  sessionStorage.setItem('analytics_ts', String(now))

  state = { visitorId, sessionId, eventSeq: 0, lastPath: null, lastSend: 0 }
  return state
}

function shouldTrack(path: string): boolean {
  if (path.startsWith('/admin') || path.startsWith('/api') || path.startsWith('/preview')) return false
  if (typeof navigator !== 'undefined' && navigator.doNotTrack === '1') return false
  return true
}

function sendPageView(path: string): void {
  if (!shouldTrack(path)) return
  const ids = getOrCreateIds()
  ids.eventSeq += 1

  const eventId = `${ids.visitorId}-${Date.now()}-${ids.eventSeq}`
  const payload = {
    eventId,
    path,
    referrer: ids.lastPath ?? (document.referrer || null),
    screenWidth: window.screen?.width ?? null,
    screenHeight: window.screen?.height ?? null,
    visitorId: ids.visitorId,
    sessionId: ids.sessionId
  }

  const url = '/api/analytics/collect'
  const body = JSON.stringify(payload)

  if (navigator.sendBeacon) {
    navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }))
  } else {
    fetch(url, { method: 'POST', body, keepalive: true, headers: { 'Content-Type': 'application/json' } }).catch(() => undefined)
  }

  ids.lastPath = path
  ids.lastSend = Date.now()
}

export default defineNuxtPlugin((nuxtApp) => {
  if (import.meta.server) return

  // track initial page load
  nuxtApp.hook('page:finish', () => {
    const route = useRoute()
    sendPageView(route.path)
  })

  // track SPA route changes
  nuxtApp.hook('page:start', () => {
    const route = useRoute()
    if (route.path !== state?.lastPath) {
      sendPageView(route.path)
    }
  })
})
