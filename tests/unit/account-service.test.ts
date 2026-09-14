import { describe, expect, it, vi } from 'vitest'

const findUserRowById = vi.fn()
const findUserById = vi.fn()
const updateUserRow = vi.fn()
const deleteSessionsForUserExcept = vi.fn()

vi.mock('../../server/repositories/user.runtime.repository', () => ({
  findUserRowById,
  findUserById,
  updateUserRow,
  findUserRowById
}))

vi.mock('../../server/repositories/session.runtime.repository', () => ({
  deleteSessionsForUserExcept,
  deleteSessionsForUser: vi.fn()
}))

vi.mock('../../server/repositories/user-profile.repository', () => ({
  findByUserId: vi.fn(),
  upsertProfile: vi.fn()
}))

describe('account profile service', () => {
  it('rejects changing another user profile', async () => {
    const { updateOwnProfile } = await import('../../server/modules/account/account.service')

    await expect(updateOwnProfile(1, 2, { name: 'x' })).rejects.toMatchObject({ statusCode: 403 })
    expect(findUserRowById).not.toHaveBeenCalled()
    expect(findUserById).not.toHaveBeenCalled()
    expect(updateUserRow).not.toHaveBeenCalled()
  })

  it('rejects malformed profile data and unsafe website URLs', async () => {
    const { updateOwnProfile, profileUpdateSchema } = await import('../../server/modules/account/account.service')
    expect(profileUpdateSchema.safeParse({ bio: 12 }).success).toBe(false)
    await expect(updateOwnProfile(1, 1, { websiteUrl: 'javascript:alert(1)' })).rejects.toMatchObject({ statusCode: 422 })
  })

  it('keeps the current session while revoking other sessions on password change', async () => {
    const { changePassword } = await import('../../server/modules/account/account.service')
    const { hashPassword } = await import('../../server/utils/password')
    findUserRowById.mockResolvedValue({ id: 1, passwordHash: await hashPassword('current-password'), status: 'active' })
    updateUserRow.mockResolvedValue(undefined)
    deleteSessionsForUserExcept.mockResolvedValue(undefined)

    await changePassword(1, 'current-password', 'new-password-123', 'current-token-hash')

    expect(deleteSessionsForUserExcept).toHaveBeenCalledWith(1, 'current-token-hash')
    expect(updateUserRow).toHaveBeenCalledWith(1, expect.objectContaining({ passwordHash: expect.stringMatching(/^scrypt:/) }))
  })
})
