/* P38 Event Registry (docs/webhook.txt §11/63-65): events are program
   capabilities registered in code — the DB only stores event_name.
   Modules register their own notifiable events; the admin UI groups by
   module. Naming: resource.action lowercase dotted (§12). */

export type EventSeverity = 'info' | 'warning' | 'error' | 'critical'

export interface EventDefinition {
  name: string
  module: string
  label: { zh: string, en: string }
  severity: EventSeverity
  /* template variables the default renderer exposes (§41) */
  variables: string[]
}

const defs = new Map<string, EventDefinition>()

export function registerEvent(def: EventDefinition): void {
  defs.set(def.name, def)
}

export function listEvents(): EventDefinition[] {
  return [...defs.values()].sort((a, b) => a.module.localeCompare(b.module) || a.name.localeCompare(b.name))
}

export function getEvent(name: string): EventDefinition | undefined {
  return defs.get(name)
}

const SEV_ORDER: Record<EventSeverity, number> = { info: 0, warning: 1, error: 2, critical: 3 }

export function severityAtLeast(actual: string, minimum: string | null): boolean {
  if (!minimum) return true
  return (SEV_ORDER[actual as EventSeverity] ?? 0) >= (SEV_ORDER[minimum as EventSeverity] ?? 0)
}

/* ---------------- first-version catalog (webhook.txt §14-22) ---------------- */

registerEvent({ name: 'post.published', module: 'content', label: { zh: '文章已发布', en: 'Post published' }, severity: 'info', variables: ['post.id', 'post.title', 'post.url'] })
registerEvent({ name: 'post.updated', module: 'content', label: { zh: '文章已更新', en: 'Post updated' }, severity: 'info', variables: ['post.id', 'post.title'] })
registerEvent({ name: 'post.unpublished', module: 'content', label: { zh: '文章已下线', en: 'Post unpublished' }, severity: 'info', variables: ['post.id', 'post.title'] })
registerEvent({ name: 'post.deleted', module: 'content', label: { zh: '文章已删除', en: 'Post deleted' }, severity: 'warning', variables: ['post.id', 'post.title'] })
registerEvent({ name: 'page.published', module: 'content', label: { zh: '页面已发布', en: 'Page published' }, severity: 'info', variables: ['page.id', 'page.title'] })
registerEvent({ name: 'page.updated', module: 'content', label: { zh: '页面已更新', en: 'Page updated' }, severity: 'info', variables: ['page.id', 'page.title'] })
registerEvent({ name: 'page.deleted', module: 'content', label: { zh: '页面已删除', en: 'Page deleted' }, severity: 'warning', variables: ['page.id', 'page.title'] })

registerEvent({ name: 'comment.created', module: 'comments', label: { zh: '新评论', en: 'New comment' }, severity: 'info', variables: ['comment.author', 'comment.excerpt', 'comment.post'] })
registerEvent({ name: 'comment.pending', module: 'comments', label: { zh: '评论待审', en: 'Comment pending approval' }, severity: 'warning', variables: ['comment.author', 'comment.excerpt'] })

registerEvent({ name: 'order.created', module: 'store', label: { zh: '新订单', en: 'New order' }, severity: 'info', variables: ['order.id', 'order.total'] })
registerEvent({ name: 'order.paid', module: 'store', label: { zh: '订单已支付', en: 'Order paid' }, severity: 'info', variables: ['order.id', 'order.total'] })
registerEvent({ name: 'order.refunded', module: 'store', label: { zh: '订单已退款', en: 'Order refunded' }, severity: 'warning', variables: ['order.id'] })
registerEvent({ name: 'payment.failed', module: 'store', label: { zh: '支付失败', en: 'Payment failed' }, severity: 'error', variables: ['order.id', 'gateway'] })
registerEvent({ name: 'advertising.purchase.pending_review', module: 'advertising', label: { zh: '广告购买待审核', en: 'Advertising purchase pending review' }, severity: 'warning', variables: ['campaign.id', 'campaign.name', 'campaign.slot', 'campaign.budget', 'order.id'] })
registerEvent({ name: 'advertising.purchase.approved', module: 'advertising', label: { zh: '广告购买已自动投放', en: 'Advertising purchase auto-approved' }, severity: 'info', variables: ['campaign.id', 'campaign.name', 'campaign.slot', 'campaign.budget', 'order.id'] })
registerEvent({ name: 'product.low_stock', module: 'store', label: { zh: '商品库存不足', en: 'Product low stock' }, severity: 'warning', variables: ['product.name'] })

registerEvent({ name: 'membership.created', module: 'membership', label: { zh: '新会员', en: 'New membership' }, severity: 'info', variables: ['membership.plan'] })
registerEvent({ name: 'membership.expired', module: 'membership', label: { zh: '会员已过期', en: 'Membership expired' }, severity: 'info', variables: ['membership.plan'] })

registerEvent({ name: 'security.login_failed', module: 'security', label: { zh: '管理员登录失败', en: 'Admin login failed' }, severity: 'warning', variables: ['user.email'] })
registerEvent({ name: 'security.password_changed', module: 'security', label: { zh: '管理员密码已修改', en: 'Admin password changed' }, severity: 'warning', variables: ['user.email'] })
registerEvent({ name: 'security.role_changed', module: 'security', label: { zh: '管理员角色变更', en: 'Admin role changed' }, severity: 'warning', variables: ['user.email'] })

registerEvent({ name: 'ai.report.completed', module: 'ai', label: { zh: 'AI 报告完成', en: 'AI report completed' }, severity: 'info', variables: ['report.name'] })
registerEvent({ name: 'ai.provider.failed', module: 'ai', label: { zh: 'AI Provider 异常', en: 'AI provider failed' }, severity: 'error', variables: ['provider'] })

registerEvent({ name: 'backup.completed', module: 'backup', label: { zh: '备份完成', en: 'Backup completed' }, severity: 'info', variables: ['backup.id'] })
registerEvent({ name: 'backup.failed', module: 'backup', label: { zh: '备份失败', en: 'Backup failed' }, severity: 'error', variables: ['backup.id'] })
registerEvent({ name: 'restore.completed', module: 'backup', label: { zh: '恢复完成', en: 'Restore completed' }, severity: 'info', variables: ['backup.id'] })
registerEvent({ name: 'restore.failed', module: 'backup', label: { zh: '恢复失败', en: 'Restore failed' }, severity: 'error', variables: ['backup.id'] })

registerEvent({ name: 'system.error', module: 'system', label: { zh: '系统错误', en: 'Application error' }, severity: 'error', variables: ['error.message'] })
registerEvent({ name: 'job.failed', module: 'system', label: { zh: '定时任务失败', en: 'Scheduled job failed' }, severity: 'error', variables: ['job.name'] })

/* CMS bus event (content.*) → registry event name mapping */
export async function mapCmsEvent(event: string, payload: Record<string, unknown>): Promise<{ name: string, module: string } | null> {
  const resource = String(payload.resource ?? '')
  if (event === 'content.published') return { name: resource === 'pages' ? 'page.published' : 'post.published', module: 'content' }
  if (event === 'content.afterUpdate') return { name: resource === 'pages' ? 'page.updated' : 'post.updated', module: 'content' }
  if (event === 'content.afterDelete') return { name: resource === 'pages' ? 'page.deleted' : 'post.deleted', module: 'content' }
  if (event === 'content.unpublished') return { name: resource === 'pages' ? 'page.unpublished' : 'post.unpublished', module: 'content' }
  return null
}

/* navigation group labels come from the i18n layer; here expose module ids */
export function eventModules(): Array<{ id: string, label: { zh: string, en: string } }> {
  return [
    { id: 'content', label: { zh: '内容', en: 'Content' } },
    { id: 'comments', label: { zh: '评论', en: 'Comments' } },
    { id: 'store', label: { zh: '商店', en: 'Store' } },
    { id: 'advertising', label: { zh: '广告', en: 'Advertising' } },
    { id: 'membership', label: { zh: '会员', en: 'Membership' } },
    { id: 'security', label: { zh: '安全', en: 'Security' } },
    { id: 'ai', label: { zh: 'AI', en: 'AI' } },
    { id: 'backup', label: { zh: '备份', en: 'Backup' } },
    { id: 'system', label: { zh: '系统', en: 'System' } }
  ]
}
