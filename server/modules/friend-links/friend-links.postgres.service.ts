import { createError } from 'h3'
import { and, desc, eq, gte, isNull, ne, sql } from 'drizzle-orm'
import { createHash } from 'node:crypto'
import { getPostgresDb } from '../../repositories/db-postgres.server'
import { isDomainDbReady } from '../../repositories/domain-status'
import { friendLinkChecks, friendLinkSubmissions, friendLinks } from '../../repositories/schema-postgres/friend-links'
import { extractDomain, normalizeUrl } from './url-normalizer'
import { checkBacklink, checkSite } from './checker'

/* P37 submission + friend-link services (docs/友链.txt §11/44/45/47/54):
   submissions and live links are separate tables; approval creates the
   FriendLink in a transaction; one failed check never removes a link. */

export const SUBMISSION_STATUSES = ['pending', 'reviewing', 'approved', 'rejected', 'spam'] as const
export type SubmissionStatus = typeof SUBMISSION_STATUSES[number]

function hashIp(ip: string | null): string | null {
  return ip ? createHash('sha256').update(ip).digest('hex') : null
}

export interface SubmissionInput {
  siteName: string
  siteUrl: string
  description: string
  logoUrl?: string
  contactName?: string
  contactEmail?: string
  backlinkUrl?: string
  /* honeypot — must stay empty (§47) */
  website?: string
}

function optionalHttpUrl(value: string | undefined, maxLength: number): string | null {
  const raw = value?.trim() ?? ''
  if (!raw) return null
  if (raw.length > maxLength) return null
  try {
    const url = new URL(raw)
    return url.protocol === 'http:' || url.protocol === 'https:' ? raw : null
  } catch {
    return null
  }
}

function validEmail(value: string | undefined): string | null {
  const raw = value?.trim() ?? ''
  if (!raw) return null
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw) && raw.length <= 200 ? raw : null
}

export async function createSubmission(
  input: SubmissionInput,
  meta: { ip: string | null, userAgent: string | null }
): Promise<{ id: number, siteStatus: string, backlinkStatus: string }> {
  if (!isDomainDbReady()) throw createError({ statusCode: 503, statusMessage: 'Database unavailable' })
  /* §47: honeypot — bots fill it, humans never see it */
  if (input.website && input.website.trim() !== '') {
    throw createError({ statusCode: 400, statusMessage: 'Submission rejected' })
  }

  const siteName = input.siteName.trim().slice(0, 120)
  const description = input.description.trim().slice(0, 500)
  const normalized = normalizeUrl(input.siteUrl)
  const domain = extractDomain(input.siteUrl)
  if (!siteName || !normalized || !domain) {
    throw createError({ statusCode: 422, statusMessage: 'A valid site URL and name are required' })
  }
  const logoUrl = optionalHttpUrl(input.logoUrl, 500)
  const backlinkUrl = optionalHttpUrl(input.backlinkUrl, 500)
  const contactEmail = validEmail(input.contactEmail)
  if ((input.logoUrl?.trim() && !logoUrl) || (input.backlinkUrl?.trim() && !backlinkUrl)) {
    throw createError({ statusCode: 422, statusMessage: 'Logo and backlink must be valid HTTP(S) URLs' })
  }
  if (input.contactEmail?.trim() && !contactEmail) {
    throw createError({ statusCode: 422, statusMessage: 'Please provide a valid contact email' })
  }
  const ipHash = hashIp(meta.ip)

  /* §47: 5 submissions per IP per 24h */
  if (ipHash) {
    const since = new Date(Date.now() - 24 * 3600_000)
    const countRows = await getPostgresDb()
      .select({ recent: sql<number>`count(*)` })
      .from(friendLinkSubmissions)
      .where(and(eq(friendLinkSubmissions.submitIpHash, ipHash), gte(friendLinkSubmissions.createdAt, since)))
    if (Number(countRows[0]?.recent ?? 0) >= 5) {
      throw createError({ statusCode: 429, statusMessage: 'Too many submissions — try again later' })
    }
  }

  /* §45/46: duplicate by domain — active link or pending submission */
  const [existingLink] = await getPostgresDb()
    .select({ id: friendLinks.id })
    .from(friendLinks)
    .where(and(eq(friendLinks.domain, domain), eq(friendLinks.status, 'active'), isNull(friendLinks.deletedAt)))
    .limit(1)
  if (existingLink) {
    throw createError({ statusCode: 409, statusMessage: 'This site is already in the friend links' })
  }
  const [pending] = await getPostgresDb()
    .select({ id: friendLinkSubmissions.id })
    .from(friendLinkSubmissions)
    .where(and(eq(friendLinkSubmissions.domain, domain), ne(friendLinkSubmissions.status, 'approved'), ne(friendLinkSubmissions.status, 'rejected'), ne(friendLinkSubmissions.status, 'spam')))
    .limit(1)
  if (pending) {
    throw createError({ statusCode: 409, statusMessage: 'A submission for this site is already under review' })
  }

  /* server-side checks — the client's earlier result is never trusted (§74) */
  const site = await checkSite(normalized)
  const backlink = await checkBacklink({ siteUrl: normalized, backlinkUrl, expectedDomain: domain })

  const [row] = await getPostgresDb().insert(friendLinkSubmissions).values({
    siteName,
    siteUrl: normalized,
    normalizedUrl: normalized,
    domain,
    description,
    logoUrl,
    contactName: input.contactName?.trim().slice(0, 80) || null,
    contactEmail,
    backlinkUrl,
    status: 'pending',
    backlinkStatus: backlink.status,
    backlinkCheckedAt: new Date(),
    backlinkFoundUrl: backlink.foundUrl,
    siteStatus: site.status,
    siteHttpStatus: site.httpStatus,
    siteTitleDetected: site.title.slice(0, 300) || null,
    submitIpHash: ipHash,
    userAgent: meta.userAgent?.slice(0, 300) || null
  }).returning({ id: friendLinkSubmissions.id })
  return { id: row!.id, siteStatus: site.status, backlinkStatus: backlink.status }
}

export async function listSubmissions(status?: string): Promise<Array<Record<string, unknown>>> {
  const db = getPostgresDb()
  const base = db.select().from(friendLinkSubmissions)
  const rows = status && SUBMISSION_STATUSES.includes(status as SubmissionStatus)
    ? await base.where(eq(friendLinkSubmissions.status, status)).orderBy(desc(friendLinkSubmissions.createdAt)).limit(200)
    : await base.orderBy(desc(friendLinkSubmissions.createdAt)).limit(200)
  return rows
}

export async function getSubmission(id: number): Promise<Record<string, unknown>> {
  const [row] = await getPostgresDb().select().from(friendLinkSubmissions).where(eq(friendLinkSubmissions.id, id)).limit(1)
  if (!row) throw createError({ statusCode: 404, statusMessage: 'Submission not found' })
  return row
}

/* §43/44: admin edits the normalized data BEFORE approving; approve
   creates the FriendLink + marks the submission in one transaction */
export async function approveSubmission(id: number, admin: { userId: number | null }, edits: {
  siteName?: string
  siteUrl?: string
  description?: string
  logoUrl?: string | null
  categoryId?: number | null
  featured?: boolean
  nofollow?: boolean
  backlinkUrl?: string | null
}): Promise<{ friendLinkId: number }> {
  const db = getPostgresDb()
  const [submission] = await db.select().from(friendLinkSubmissions).where(eq(friendLinkSubmissions.id, id)).limit(1)
  if (!submission) throw createError({ statusCode: 404, statusMessage: 'Submission not found' })
  if (!['pending', 'reviewing'].includes(submission.status)) {
    throw createError({ statusCode: 409, statusMessage: `Submission already ${submission.status}` })
  }

  const name = (edits.siteName ?? submission.siteName).trim().slice(0, 120) || submission.siteName
  const url = normalizeUrl(edits.siteUrl ?? submission.siteUrl) || submission.normalizedUrl
  const domain = extractDomain(url)
  const description = (edits.description ?? submission.description).trim().slice(0, 500)
  if (!domain) throw createError({ statusCode: 422, statusMessage: 'Invalid site URL' })

  const friendLinkId = await db.transaction(async (tx) => {
    const [created] = await tx.insert(friendLinks).values({
      name,
      url,
      normalizedUrl: url,
      domain,
      description,
      externalLogoUrl: (edits.logoUrl ?? submission.logoUrl) || null,
      categoryId: edits.categoryId ?? null,
      status: 'active',
      featured: edits.featured ?? false,
      nofollow: edits.nofollow ?? false,
      openInNewTab: true,
      source: 'submission',
      submissionId: submission.id,
      backlinkUrl: (edits.backlinkUrl ?? submission.backlinkFoundUrl ?? submission.backlinkUrl) || null,
      backlinkStatus: submission.backlinkStatus,
      backlinkLastCheckedAt: submission.backlinkCheckedAt,
      backlinkLastFoundAt: submission.backlinkStatus === 'found' ? submission.backlinkCheckedAt : null
    }).returning({ id: friendLinks.id })
    await tx.update(friendLinkSubmissions).set({
      status: 'approved',
      reviewerId: admin.userId,
      reviewedAt: new Date(),
      siteName: name,
      siteUrl: url,
      normalizedUrl: url,
      domain,
      description
    }).where(eq(friendLinkSubmissions.id, id))
    return created!.id
  })
  await invalidateFriendLinksCache()
  return { friendLinkId }
}

export async function reviewSubmission(id: number, action: 'reject' | 'spam' | 'reviewing', admin: { userId: number | null }, reason?: string): Promise<void> {
  const db = getPostgresDb()
  const patch: Record<string, unknown> = {
    status: action === 'reject' ? 'rejected' : action === 'spam' ? 'spam' : 'reviewing',
    reviewerId: admin.userId,
    reviewedAt: new Date()
  }
  if (reason) patch.rejectionReason = reason.slice(0, 300)
  await db.update(friendLinkSubmissions).set(patch).where(eq(friendLinkSubmissions.id, id))
}

/* ---------------- admin friend link CRUD (§40) ---------------- */

export interface FriendLinkInput {
  name: string
  url: string
  description?: string
  logoMediaId?: number | null
  externalLogoUrl?: string | null
  categoryId?: number | null
  featured?: boolean
  sortOrder?: number
  backlinkRequired?: boolean
  backlinkUrl?: string | null
  nofollow?: boolean
  openInNewTab?: boolean
  status?: string
}

export async function createFriendLink(input: FriendLinkInput): Promise<number> {
  const normalized = normalizeUrl(input.url)
  const domain = extractDomain(input.url)
  if (!normalized || !domain) throw createError({ statusCode: 422, statusMessage: 'Invalid site URL' })
  const [row] = await getPostgresDb().insert(friendLinks).values({
    name: input.name.trim().slice(0, 120),
    url: normalized,
    normalizedUrl: normalized,
    domain,
    description: (input.description ?? '').trim().slice(0, 500),
    logoMediaId: input.logoMediaId ?? null,
    externalLogoUrl: input.externalLogoUrl || null,
    categoryId: input.categoryId ?? null,
    status: input.status ?? 'active',
    featured: input.featured ?? false,
    sortOrder: input.sortOrder ?? 0,
    backlinkRequired: input.backlinkRequired ?? false,
    backlinkUrl: input.backlinkUrl || null,
    nofollow: input.nofollow ?? false,
    openInNewTab: input.openInNewTab ?? true,
    source: 'admin'
  }).returning({ id: friendLinks.id })
  await invalidateFriendLinksCache()
  return row!.id
}

export async function updateFriendLink(id: number, input: Partial<FriendLinkInput>): Promise<void> {
  const patch: Record<string, unknown> = {}
  if (input.name !== undefined) patch.name = input.name.trim().slice(0, 120)
  if (input.url !== undefined) {
    const normalized = normalizeUrl(input.url)
    if (!normalized) throw createError({ statusCode: 422, statusMessage: 'Invalid site URL' })
    patch.url = normalized
    patch.normalizedUrl = normalized
    patch.domain = extractDomain(input.url)
  }
  if (input.description !== undefined) patch.description = input.description.trim().slice(0, 500)
  if (input.logoMediaId !== undefined) patch.logoMediaId = input.logoMediaId
  if (input.externalLogoUrl !== undefined) patch.externalLogoUrl = input.externalLogoUrl || null
  if (input.categoryId !== undefined) patch.categoryId = input.categoryId
  if (input.featured !== undefined) patch.featured = input.featured
  if (input.sortOrder !== undefined) patch.sortOrder = input.sortOrder
  if (input.backlinkRequired !== undefined) patch.backlinkRequired = input.backlinkRequired
  if (input.backlinkUrl !== undefined) patch.backlinkUrl = input.backlinkUrl || null
  if (input.nofollow !== undefined) patch.nofollow = input.nofollow
  if (input.openInNewTab !== undefined) patch.openInNewTab = input.openInNewTab
  if (input.status !== undefined && ['active', 'disabled', 'broken', 'removed'].includes(input.status)) patch.status = input.status
  await getPostgresDb().update(friendLinks).set(patch).where(eq(friendLinks.id, id))
  await invalidateFriendLinksCache()
}

export async function deleteFriendLink(id: number): Promise<void> {
  await getPostgresDb().update(friendLinks).set({ status: 'removed', deletedAt: new Date() }).where(eq(friendLinks.id, id))
  await invalidateFriendLinksCache()
}

/* ---------------- checks (§50/52/54) ---------------- */

async function recordCheck(friendLinkId: number, checkType: 'site' | 'backlink', status: string, httpStatus: number | null, foundUrl: string | null): Promise<void> {
  await getPostgresDb().insert(friendLinkChecks).values({ friendLinkId, checkType, status, httpStatus, foundUrl })
}

export async function checkFriendLinkNow(id: number): Promise<{ siteStatus: string, backlinkStatus: string }> {
  const [link] = await getPostgresDb().select().from(friendLinks).where(eq(friendLinks.id, id)).limit(1)
  if (!link) throw createError({ statusCode: 404, statusMessage: 'Friend link not found' })

  const site = await checkSite(link.normalizedUrl)
  const backlink = await checkBacklink({ siteUrl: link.normalizedUrl, backlinkUrl: link.backlinkUrl, expectedDomain: link.domain })
  const now = new Date()

  const backlinkStatus = backlink.status === 'found'
    ? 'found'
    : ['unreachable', 'error'].includes(backlink.status)
        ? 'unreachable'
        : backlink.status
  const failureCount = backlinkStatus === 'not_found' ? link.backlinkFailureCount + 1 : 0

  await getPostgresDb().update(friendLinks).set({
    backlinkStatus,
    backlinkLastCheckedAt: now,
    backlinkLastFoundAt: backlinkStatus === 'found' ? now : link.backlinkLastFoundAt,
    backlinkFailureCount: failureCount
  }).where(eq(friendLinks.id, id))

  await recordCheck(id, 'site', site.status, site.httpStatus, site.finalUrl)
  await recordCheck(id, 'backlink', backlinkStatus, backlink.httpStatus, backlink.foundUrl)
  await invalidateFriendLinksCache()
  return { siteStatus: site.status, backlinkStatus }
}

/* §52/53: scheduled pass — concurrency 5, failure counting, no auto-removal */
export async function runScheduledChecks(): Promise<{ checked: number, missing: number }> {
  if (!isDomainDbReady()) return { checked: 0, missing: 0 }
  const { getSettingValue } = await import('../settings/settings.service')
  if (String(await getSettingValue('friend_links.auto_check_backlink', 'true')) === 'false') {
    return { checked: 0, missing: 0 }
  }
  const rows = await getPostgresDb()
    .select({ id: friendLinks.id, normalizedUrl: friendLinks.normalizedUrl, domain: friendLinks.domain, backlinkUrl: friendLinks.backlinkUrl, backlinkFailureCount: friendLinks.backlinkFailureCount })
    .from(friendLinks)
    .where(and(eq(friendLinks.status, 'active'), isNull(friendLinks.deletedAt)))
    .limit(500)

  let checked = 0
  let missing = 0
  const queue = [...rows]
  const workers = Array.from({ length: 5 }, async () => {
    for (;;) {
      const link = queue.shift()
      if (!link) return
      const backlink = await checkBacklink({ siteUrl: link.normalizedUrl, backlinkUrl: link.backlinkUrl, expectedDomain: link.domain })
      const now = new Date()
      const status = backlink.status === 'found' ? 'found' : ['unreachable', 'error'].includes(backlink.status) ? 'unreachable' : 'not_found'
      const failureCount = status === 'not_found' ? link.backlinkFailureCount + 1 : 0
      await getPostgresDb().update(friendLinks).set({
        backlinkStatus: status,
        backlinkLastCheckedAt: now,
        backlinkLastFoundAt: status === 'found' ? now : undefined,
        backlinkFailureCount: failureCount
      }).where(eq(friendLinks.id, link.id))
      await recordCheck(link.id, 'backlink', status, backlink.httpStatus, backlink.foundUrl)
      checked++
      if (status === 'not_found') missing++
    }
  })
  await Promise.all(workers)
  return { checked, missing }
}

/* ---------------- public reads (§61/69/87) ---------------- */

export interface PublicFriendLink {
  id: number
  name: string
  url: string
  domain: string
  description: string
  logoUrl: string | null
  categoryId: number | null
  featured: boolean
  nofollow: boolean
  openInNewTab: boolean
}

let cache: { body: PublicFriendLink[], at: number } | null = null
const CACHE_TTL_MS = 30 * 60_000

export async function invalidateFriendLinksCache(): Promise<void> {
  cache = null
}

export async function getPublicFriendLinks(): Promise<PublicFriendLink[]> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.body
  if (!isDomainDbReady()) return []
  const rows = await getPostgresDb()
    .select({
      id: friendLinks.id,
      name: friendLinks.name,
      url: friendLinks.url,
      domain: friendLinks.domain,
      description: friendLinks.description,
      logoMediaId: friendLinks.logoMediaId,
      externalLogoUrl: friendLinks.externalLogoUrl,
      categoryId: friendLinks.categoryId,
      featured: friendLinks.featured,
      nofollow: friendLinks.nofollow,
      openInNewTab: friendLinks.openInNewTab
    })
    .from(friendLinks)
    .where(and(eq(friendLinks.status, 'active'), isNull(friendLinks.deletedAt)))
    .orderBy(desc(friendLinks.featured), friendLinks.sortOrder, friendLinks.name)
    .limit(200)
  const body = rows.map((row) => {
    return {
      id: row.id,
      name: row.name,
      url: row.url,
      domain: row.domain,
      description: row.description,
      logoUrl: row.logoMediaId ? null : row.externalLogoUrl,
      categoryId: row.categoryId,
      featured: row.featured,
      nofollow: row.nofollow,
      openInNewTab: row.openInNewTab
    }
  })
  cache = { body, at: Date.now() }
  return body
}
