import { requireUser } from '../../utils/auth'
import { findAccountActivity } from '../../repositories/account-activity.repository'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  return findAccountActivity(user.id)
})
