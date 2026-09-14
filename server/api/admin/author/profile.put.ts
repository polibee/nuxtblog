import { requirePermission } from '../../../utils/auth'
import { getProfileBundle, saveProfileBundle } from '../../../modules/profile/profile.runtime.service'

/** PUT /api/admin/author/profile — bulk-save the whole profile bundle
    in one transaction (collections are replace-all per table). */
export default defineEventHandler(async (event) => {
  await requirePermission(event, 'profile.edit')
  const body = await readBody(event) as Partial<ReturnType<typeof Object>> & Record<string, unknown>
  const asArray = (v: unknown): Record<string, unknown>[] => Array.isArray(v) ? v as Record<string, unknown>[] : []
  await saveProfileBundle({
    profile: (body.profile ?? {}) as Record<string, unknown>,
    translations: (body.translations ?? {}) as Record<string, { displayName: string, headline: string, bio: string, location: string }>,
    socials: asArray(body.socials),
    sections: asArray(body.sections),
    experiences: asArray(body.experiences),
    projects: asArray(body.projects),
    skills: asArray(body.skills),
    education: asArray(body.education),
    certifications: asArray(body.certifications),
    focusItems: asArray(body.focusItems)
  })
  return await getProfileBundle()
})
