import { getOwnProfile } from '../../modules/account/account.service'
import { requireUser } from '../../utils/auth'

export default defineEventHandler(async event => getOwnProfile((await requireUser(event)).id))
