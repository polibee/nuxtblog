import { isIP } from 'node:net'
import { lookup } from 'node:dns/promises'
import { normalizeDomain } from './url-normalizer'

/* P37 Backlink/Site Checker (docs/友链.txt §18-36): fetches REMOTE,
   user-submitted URLs — a textbook SSRF entry point. Hard rules:
   http(s) only, no private/loopback/link-local IPs (re-resolved on
   every redirect), max 5 redirects, 8s timeout, 2MB response, explicit
   User-Agent, HTML parsing of real <a href> — never substring matching. */

const USER_AGENT = 'NuxtBlog-LinkChecker/1.0'
const MAX_REDIRECTS = 5
const TIMEOUT_MS = 8000
const MAX_BODY_BYTES = 2 * 1024 * 1024

export interface FetchResult {
  ok: boolean
  status: number
  finalUrl: string
  body: string
  title: string
  latencyMs: number
  https: boolean
  error?: string
}

/* §29: blocked IP ranges */
function isPrivateIp(ip: string): boolean {
  if (isIP(ip) === 4) {
    const parts = ip.split('.').map(Number)
    const [a, b] = parts as [number, number, number, number]
    if (a === 10 || a === 127) return true
    if (a === 172 && b >= 16 && b <= 31) return true
    if (a === 192 && b === 168) return true
    if (a === 169 && b === 254) return true
    if (a === 0) return true
    return false
  }
  if (isIP(ip) === 6) {
    const lower = ip.toLowerCase()
    if (lower === '::1' || lower === '::') return true
    if (lower.startsWith('fc') || lower.startsWith('fd')) return true
    if (lower.startsWith('fe8') || lower.startsWith('fe9') || lower.startsWith('fea') || lower.startsWith('feb')) return true
    if (lower.startsWith('::ffff:127.')) return true
    return false
  }
  return true /* unparseable → block */
}

/* §30: DNS resolve + IP check (DNS rebinding defence) */
async function assertPublicHost(hostname: string): Promise<void> {
  if (isIP(hostname)) {
    if (isPrivateIp(hostname)) throw new Error('private address blocked')
    return
  }
  if (hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local') || hostname.endsWith('.internal')) {
    throw new Error('private host blocked')
  }
  const records = await lookup(hostname, { all: true, verbatim: true })
  if (records.length === 0) throw new Error('dns resolution failed')
  for (const record of records) {
    if (isPrivateIp(record.address)) throw new Error('resolves to private address')
  }
}

async function readLimited(response: Response): Promise<string> {
  const reader = response.body?.getReader()
  if (!reader) return ''
  const chunks: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    if (value) {
      total += value.byteLength
      if (total > MAX_BODY_BYTES) {
        reader.cancel().catch(() => undefined)
        throw new Error('response too large')
      }
      chunks.push(value)
    }
  }
  const merged = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    merged.set(chunk, offset)
    offset += chunk.byteLength
  }
  return new TextDecoder('utf-8', { fatal: false }).decode(merged)
}

/** §31: manual redirect chain — every hop re-validates the host */
async function fetchWithGuards(rawUrl: string): Promise<FetchResult> {
  const startedAt = Date.now()
  let currentUrl = rawUrl
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    let parsed: URL
    try {
      parsed = new URL(currentUrl)
    } catch {
      return fail('invalid url')
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return fail('only http/https allowed')
    try {
      await assertPublicHost(parsed.hostname)
    } catch (e) {
      return fail((e as Error).message)
    }

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
    let response: Response
    try {
      response = await fetch(parsed.toString(), {
        method: 'GET',
        redirect: 'manual',
        signal: controller.signal,
        headers: { 'User-Agent': USER_AGENT, 'Accept': 'text/html,text/*;q=0.8,*/*;q=0.5' }
      })
    } catch (e) {
      clearTimeout(timer)
      const message = (e as Error).message || ''
      if (message.includes('abort')) return fail('timeout')
      return fail('unreachable')
    }
    clearTimeout(timer)

    /* redirect hop — validate the Location target and continue */
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location')
      if (!location) return { ...emptyBody(response, parsed), error: 'redirect without location' }
      try {
        currentUrl = new URL(location, parsed).toString()
      } catch {
        return fail('invalid redirect target')
      }
      continue
    }

    const contentType = response.headers.get('content-type') ?? ''
    if (!contentType.includes('text/html') && response.status >= 200 && response.status < 300) {
      return {
        ok: response.ok,
        status: response.status,
        finalUrl: parsed.toString(),
        body: '',
        title: '',
        latencyMs: Date.now() - startedAt,
        https: parsed.protocol === 'https:',
        error: 'not html'
      }
    }
    let body: string
    try {
      body = await readLimited(response)
    } catch (e) {
      return {
        ok: false,
        status: response.status,
        finalUrl: parsed.toString(),
        body: '',
        title: '',
        latencyMs: Date.now() - startedAt,
        https: parsed.protocol === 'https:',
        error: (e as Error).message
      }
    }
    return {
      ok: response.ok,
      status: response.status,
      finalUrl: parsed.toString(),
      body,
      title: extractTitle(body),
      latencyMs: Date.now() - startedAt,
      https: parsed.protocol === 'https:'
    }
  }
  return fail('too many redirects')

  function fail(message: string): FetchResult {
    return { ok: false, status: 0, finalUrl: rawUrl, body: '', title: '', latencyMs: Date.now() - startedAt, https: rawUrl.startsWith('https://'), error: message }
  }

  function emptyBody(response: Response, parsed: URL): FetchResult {
    return { ok: false, status: response.status, finalUrl: parsed.toString(), body: '', title: '', latencyMs: Date.now() - startedAt, https: parsed.protocol === 'https:' }
  }
}

function extractTitle(html: string): string {
  const match = /<title[^>]*>([^<]{0,300})<\/title>/i.exec(html)
  return match ? match[1]!.trim() : ''
}

/* ---------------- backlink detection (§22/25/26) ---------------- */

export interface BacklinkFinding {
  status: 'found' | 'not_found' | 'unreachable' | 'error'
  httpStatus: number
  foundUrl: string | null
  anchor: string | null
  rel: string | null
}

/** extract every <a href> and match by real hostname (§22) */
function findBacklink(html: string, expectedDomain: string): BacklinkFinding | null {
  const re = /<a\b[^>]*href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))[^>]*>([\s\S]{0,300}?)<\/a\s*>/gi
  let match = re.exec(html)
  while (match) {
    const href = (match[1] ?? match[2] ?? match[3] ?? '').trim()
    const inner = (match[4] ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    const tag = match[0]
    match = re.exec(html)
    if (!href || href.startsWith('#') || /^(mailto|javascript|tel):/i.test(href)) continue
    let target: URL
    try {
      target = new URL(href)
    } catch {
      continue
    }
    if (normalizeDomain(target.hostname) !== expectedDomain) continue
    const rel = /rel\s*=\s*(?:"([^"]*)"|'([^']*)')/i.exec(tag)
    return {
      status: 'found',
      httpStatus: 200,
      foundUrl: href,
      anchor: inner || null,
      rel: rel ? (rel[1] ?? rel[2] ?? '').toLowerCase() : null
    }
  }
  return null
}

export interface BacklinkCheckRequest {
  siteUrl: string
  backlinkUrl?: string | null
  expectedDomain: string
}

/* §21: backlink_url → homepage → a few common paths; never a crawler */
const COMMON_LINK_PATHS = ['/friends', '/links', '/link', '/blogroll']

export async function checkBacklink(request: BacklinkCheckRequest): Promise<BacklinkFinding> {
  const expectedDomain = normalizeDomain(request.expectedDomain)
  if (!expectedDomain) return { status: 'error', httpStatus: 0, foundUrl: null, anchor: null, rel: null }

  const candidates: string[] = []
  if (request.backlinkUrl) candidates.push(request.backlinkUrl)
  candidates.push(request.siteUrl)
  for (const path of COMMON_LINK_PATHS) {
    candidates.push(`${request.siteUrl.replace(/\/+$/, '')}${path}`)
  }

  for (const candidate of candidates) {
    const result = await fetchWithGuards(candidate)
    if (result.error === 'timeout' || result.error === 'unreachable' || result.error === 'too many redirects') {
      if (candidate === candidates[0]) continue
      return { status: 'unreachable', httpStatus: result.status, foundUrl: null, anchor: null, rel: null }
    }
    if (result.body) {
      const finding = findBacklink(result.body, expectedDomain)
      if (finding) {
        return { ...finding, httpStatus: result.status, foundUrl: finding.foundUrl ?? result.finalUrl }
      }
    }
  }
  return { status: 'not_found', httpStatus: 0, foundUrl: null, anchor: null, rel: null }
}

/* ---------------- site availability (§35/36) ---------------- */

export interface SiteCheckResult {
  status: 'online' | 'unreachable' | 'timeout' | 'error'
  httpStatus: number | null
  finalUrl: string
  title: string
  latencyMs: number
  https: boolean
}

export async function checkSite(siteUrl: string): Promise<SiteCheckResult> {
  const result = await fetchWithGuards(siteUrl)
  if (result.error === 'timeout') {
    return { status: 'timeout', httpStatus: null, finalUrl: result.finalUrl, title: '', latencyMs: result.latencyMs, https: result.https }
  }
  if (result.error && result.status === 0) {
    return { status: 'unreachable', httpStatus: null, finalUrl: result.finalUrl, title: '', latencyMs: result.latencyMs, https: result.https }
  }
  if (result.status >= 200 && result.status < 400) {
    return { status: 'online', httpStatus: result.status, finalUrl: result.finalUrl, title: result.title, latencyMs: result.latencyMs, https: result.https }
  }
  return { status: 'error', httpStatus: result.status, finalUrl: result.finalUrl, title: result.title, latencyMs: result.latencyMs, https: result.https }
}
