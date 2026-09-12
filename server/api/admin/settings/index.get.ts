import { requirePermission } from '../../../utils/auth'
import { listSettings } from '../../../modules/settings/settings.runtime.service'

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'settings.view')
  const query = getQuery(event) as { page?: number, perPage?: number, q?: string }
  const items = await listSettings()
  const filtered = query.q
    ? items.filter(s => s.key.toLowerCase().includes(String(query.q).toLowerCase()))
    : items
  const page = Math.max(Number(query.page) || 1, 1)
  const perPage = Math.min(Math.max(Number(query.perPage) || 200, 1), 200)
  const total = filtered.length
  return {
    items: filtered.slice((page - 1) * perPage, page * perPage),
    total,
    page,
    perPage,
    totalPages: Math.max(Math.ceil(total / perPage), 1)
  }
})
