import { profileUpdateSchema, updateOwnProfile } from '../../modules/account/account.service'
import { requireUser } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const parsed = profileUpdateSchema.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 422, statusMessage: 'Invalid profile data' })
  return updateOwnProfile(user.id, user.id, parsed.data)
})
