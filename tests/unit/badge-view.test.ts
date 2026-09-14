import { describe, expect, it } from 'vitest'

describe('public badge view', () => {
  it('excludes an expired vip grant from the public identity badges', async () => {
    const { projectPublicBadges } = await import('../../server/modules/badges/badge.service')
    const now = new Date('2026-09-12T00:00:00.000Z')

    expect(projectPublicBadges({
      userStatus: 'active',
      hasActiveMembership: false,
      hasPaidOrder: false,
      granted: [{
        key: 'vip',
        expiresAt: new Date('2026-09-11T23:59:59.000Z')
      }],
      definitions: [{
        key: 'vip',
        name: 'VIP',
        description: 'VIP',
        icon: 'crown',
        color: 'gold'
      }]
    }, now)).toEqual([])
  })
})
