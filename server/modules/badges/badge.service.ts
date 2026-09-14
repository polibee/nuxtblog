import { createError } from 'h3'
import { findUserRowById } from '../../repositories/user.runtime.repository'
import { getBadgeProjectionSources, grantBadge, revokeBadge, type BadgeProjectionSources } from '../../repositories/badge.repository'
import type { PublicBadgeView, UserIdentityView } from '#shared/types/badge'

export function projectPublicBadges(sources: BadgeProjectionSources, now: Date): PublicBadgeView[] {
  const eligible = new Set<string>()
  if (sources.userStatus === 'active') eligible.add('member')
  if (sources.hasActiveMembership) eligible.add('vip')
  if (sources.hasPaidOrder) eligible.add('supporter')
  for (const grant of sources.granted) {
    if (!grant.expiresAt || grant.expiresAt > now) eligible.add(grant.key)
  }
  return sources.definitions.filter(definition => eligible.has(definition.key))
}

export async function listPublicBadges(userId: number, now = new Date()): Promise<PublicBadgeView[]> {
  return projectPublicBadges(await getBadgeProjectionSources(userId, now), now)
}

export async function getUserIdentityView(userId: number): Promise<UserIdentityView> {
  const user = await findUserRowById(userId)
  if (!user) throw createError({ statusCode: 404, statusMessage: `User #${userId} not found` })
  return { userId: user.id, displayName: user.name, badges: await listPublicBadges(user.id) }
}

export { grantBadge, revokeBadge }
