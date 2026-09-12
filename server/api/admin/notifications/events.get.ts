import { requirePermission } from '../../../utils/auth'
import { listEvents, eventModules } from '../../../modules/notifications/event-registry'

/** GET /api/admin/notifications/events — from the code registry
    (webhook.txt §67), grouped by module for the Event Picker. */
export default defineEventHandler(async (event) => {
  await requirePermission(event, 'notifications.view')
  const query = getQuery(event) as { search?: string }
  const search = String(query.search ?? '').trim().toLowerCase()
  const events = listEvents().filter(e =>
    !search
    || e.name.includes(search)
    || e.label.zh.toLowerCase().includes(search)
    || e.label.en.toLowerCase().includes(search)
  )
  return { events, modules: eventModules() }
})
