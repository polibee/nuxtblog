import { describe, expect, it, vi } from 'vitest'

const getBadgeProjectionSources = vi.fn()

vi.mock('../../server/repositories/badge.repository', () => ({
  getBadgeProjectionSources
}))

describe('badge service', () => {
  it('projects an unexpired membership into the public vip badge', async () => {
    const { listPublicBadges } = await import('../../server/modules/badges/badge.service')
    const now = new Date('2026-09-12T00:00:00.000Z')
    getBadgeProjectionSources.mockResolvedValue({
      userStatus: 'active',
      hasActiveMembership: true,
      hasPaidOrder: false,
      granted: [],
      definitions: [
        { key: 'member', name: 'Member', description: 'Member', icon: 'user', color: 'blue' },
        { key: 'vip', name: 'VIP', description: 'VIP', icon: 'crown', color: 'gold' }
      ]
    })

    await expect(listPublicBadges(7, now)).resolves.toEqual([
      { key: 'member', name: 'Member', description: 'Member', icon: 'user', color: 'blue' },
      { key: 'vip', name: 'VIP', description: 'VIP', icon: 'crown', color: 'gold' }
    ])
  })
})
