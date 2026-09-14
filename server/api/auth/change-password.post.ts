import { changePassword, changePasswordSchema } from '../../modules/account/account.service'
import { requireUser } from '../../utils/auth'
import { hashToken } from '../../utils/password'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const parsed = changePasswordSchema.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 422, statusMessage: 'Invalid password data' })
  const currentToken = getCookie(event, 'admin_session')
  await changePassword(user.id, parsed.data.currentPassword, parsed.data.newPassword, currentToken ? hashToken(currentToken) : undefined)
  return { ok: true }
})
