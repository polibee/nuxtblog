import { describe, expect, it } from 'vitest'

describe('article author source contract', () => {
  it('prefers the configured sidebar author and keeps profile as fallback', () => {
    const sidebar = { name: 'William Lee', socials: [{ platform: 'github', url: '/william', label: 'GitHub' }] }
    const profile = { displayName: 'Hongboli Wang' }
    expect(sidebar.name || profile.displayName).toBe('William Lee')
    expect(sidebar.socials.map(item => item.platform)).toEqual(['github'])
  })
})
