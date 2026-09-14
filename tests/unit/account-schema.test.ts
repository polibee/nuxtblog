import { describe, expect, it, vi } from 'vitest'

const insertUser = vi.fn()
const emailExists = vi.fn()
const upsertProfile = vi.fn()

vi.mock('../../server/repositories/user.runtime.repository', () => ({
  emailExists,
  insertUser
}))

vi.mock('../../server/repositories/user-profile.repository', () => ({
  upsertProfile
}))

describe('account registration contract', () => {
  it('normalizes registration email and creates an active viewer profile', async () => {
    emailExists.mockResolvedValue(false)
    insertUser.mockResolvedValue({
      id: 7,
      email: 'user@example.com',
      name: 'Lee',
      role: 'viewer',
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    })
    upsertProfile.mockResolvedValue(undefined)

    const { registerUser } = await import('../../server/modules/account/account.service')
    const user = await registerUser({ email: ' User@Example.COM ', name: 'Lee', password: 'long-password' })

    expect(user.email).toBe('user@example.com')
    expect(user.role).toBe('viewer')
    expect(emailExists).toHaveBeenCalledWith('user@example.com')
    expect(insertUser).toHaveBeenCalledWith(expect.objectContaining({
      email: 'user@example.com',
      role: 'viewer',
      status: 'active',
      passwordHash: expect.stringMatching(/^scrypt:/)
    }))
    expect(upsertProfile).toHaveBeenCalledWith(7, {})
  })

  it('exposes only safe registration fields', async () => {
    const { toRegistrationResponse } = await import('../../server/modules/account/account.service')
    expect(toRegistrationResponse({ id: 7, name: 'Lee', email: 'user@example.com', role: 'viewer', permissions: ['*'] })).toEqual({
      user: { id: 7, name: 'Lee', role: 'viewer' }
    })
  })
})
