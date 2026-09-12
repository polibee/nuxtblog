import { createSubmission } from '../../modules/friend-links/friend-links.runtime.service'
import { getSettingValue } from '../../modules/settings/settings.runtime.service'

/** POST /api/friend-links/submissions — public friend link application
    (docs/友链.txt §12/47): honeypot + per-IP rate limit server-side;
    site + backlink checks re-run here, client results are never trusted. */
export default defineEventHandler(async (event) => {
  if (String(await getSettingValue('friend_links.enabled', 'true')) === 'false') {
    throw createError({ statusCode: 403, statusMessage: 'Friend links are disabled' })
  }
  if (String(await getSettingValue('friend_links.submissions_enabled', 'true')) === 'false') {
    throw createError({ statusCode: 403, statusMessage: 'Submissions are currently closed' })
  }
  const body = await readBody(event) as Record<string, unknown>
  const result = await createSubmission({
    siteName: String(body?.siteName ?? ''),
    siteUrl: String(body?.siteUrl ?? ''),
    description: String(body?.description ?? ''),
    logoUrl: body?.logoUrl ? String(body.logoUrl) : undefined,
    contactName: body?.contactName ? String(body.contactName) : undefined,
    contactEmail: body?.contactEmail ? String(body.contactEmail) : undefined,
    backlinkUrl: body?.backlinkUrl ? String(body.backlinkUrl) : undefined,
    website: body?.website ? String(body.website) : undefined
  }, {
    ip: getRequestIP(event, { xForwardedFor: true }) ?? null,
    userAgent: getRequestHeader(event, 'user-agent') ?? null
  })
  return { ok: true, submissionId: result.id, siteStatus: result.siteStatus, backlinkStatus: result.backlinkStatus }
})
