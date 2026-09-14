import { requireUser } from '../../../utils/auth'
import { findAccountActivity } from '../../../repositories/account-activity.repository'

function cell(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value)
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const activity = await findAccountActivity(user.id)
  const lines = ['section,id,reference,status,amount,currency,created_at']
  for (const item of activity.orders) lines.push(['orders', item.id, item.orderNumber, item.status, item.totalMinor, item.currency, item.createdAt.toISOString()].map(cell).join(','))
  for (const item of activity.payments) lines.push(['payments', item.id, item.orderNumber, item.status, item.amountMinor, item.currency, item.createdAt.toISOString()].map(cell).join(','))
  for (const item of activity.comments) lines.push(['comments', item.id, `post-${item.postId}`, item.status, '', '', item.createdAt.toISOString()].map(cell).join(','))
  for (const item of activity.advertising) lines.push(['advertising', item.id, item.name, item.status, item.budgetMinor, item.currency, item.createdAt.toISOString()].map(cell).join(','))
  for (const item of activity.exports) lines.push(['exports', item.id, item.type, item.status, item.rowCount, '', item.createdAt.toISOString()].map(cell).join(','))

  setResponseHeader(event, 'content-type', 'text/csv; charset=utf-8')
  setResponseHeader(event, 'content-disposition', 'attachment; filename="account-activity.csv"')
  return `\uFEFF${lines.join('\r\n')}\r\n`
})
