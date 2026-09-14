import { and, eq, gt, isNull, or } from 'drizzle-orm'
import { getDb } from './db.server'
import { badges, userBadges } from './schema/badges'
import { membershipPlans, subscriptions } from './schema/membership'
import { orders } from './schema/orders'
import { users } from './schema/users'
import type { PublicBadgeView } from '#shared/types/badge'

export interface BadgeProjectionSources {
  userStatus: string | null
  hasActiveMembership: boolean
  hasPaidOrder: boolean
  granted: Array<{ key: string, expiresAt: Date | null }>
  definitions: PublicBadgeView[]
}

export async function getBadgeProjectionSources(userId: number, now: Date): Promise<BadgeProjectionSources> {
  const db = getDb()
  const [user] = await db.select({ status: users.status }).from(users).where(eq(users.id, userId)).limit(1)
  const [membership] = await db.select({ id: subscriptions.id })
    .from(subscriptions)
    .innerJoin(membershipPlans, eq(membershipPlans.id, subscriptions.planId))
    .where(and(eq(subscriptions.userId, userId), eq(subscriptions.status, 'active'), gt(subscriptions.currentPeriodEnd, now)))
    .limit(1)
  const [paidOrder] = await db.select({ id: orders.id }).from(orders)
    .where(and(eq(orders.userId, userId), or(eq(orders.status, 'paid'), eq(orders.status, 'fulfilled'), eq(orders.paymentStatus, 'captured'))))
    .limit(1)
  const [definitions, granted] = await Promise.all([
    db.select({ key: badges.key, name: badges.name, description: badges.description, icon: badges.icon, color: badges.color })
      .from(badges).where(eq(badges.enabled, true)).orderBy(badges.sortOrder),
    db.select({ key: badges.key, expiresAt: userBadges.expiresAt })
      .from(userBadges).innerJoin(badges, eq(badges.id, userBadges.badgeId))
      .where(and(eq(userBadges.userId, userId), eq(badges.enabled, true), or(isNull(userBadges.expiresAt), gt(userBadges.expiresAt, now))))
  ])
  return {
    userStatus: user?.status ?? null,
    hasActiveMembership: Boolean(membership),
    hasPaidOrder: Boolean(paidOrder),
    granted,
    definitions
  }
}

export async function grantBadge(input: { userId: number, badgeKey: string, sourceType: string, sourceId?: number | null, expiresAt?: Date | null }): Promise<void> {
  const db = getDb()
  const [badge] = await db.select({ id: badges.id }).from(badges).where(eq(badges.key, input.badgeKey)).limit(1)
  if (!badge) throw new Error(`Unknown badge: ${input.badgeKey}`)
  await db.insert(userBadges).values({ userId: input.userId, badgeId: badge.id, sourceType: input.sourceType, sourceId: input.sourceId ?? null, expiresAt: input.expiresAt ?? null }).onDuplicateKeyUpdate({
    set: { sourceType: input.sourceType, sourceId: input.sourceId ?? null, expiresAt: input.expiresAt ?? null }
  })
}

export async function revokeBadge(userId: number, badgeKey: string): Promise<void> {
  const db = getDb()
  const [badge] = await db.select({ id: badges.id }).from(badges).where(eq(badges.key, badgeKey)).limit(1)
  if (!badge) return
  await db.delete(userBadges).where(and(eq(userBadges.userId, userId), eq(userBadges.badgeId, badge.id)))
}
