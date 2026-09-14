import { describe, expect, it, vi } from 'vitest'
import { readFile } from 'node:fs/promises'

const findUserRowById = vi.fn()
const findUserById = vi.fn()
const updateUserRow = vi.fn()
const grantBadge = vi.fn()
const revokeBadge = vi.fn()

vi.mock('../../server/repositories/user.runtime.repository', () => ({
  findUserRowById,
  findUserById,
  updateUserRow,
  countUsers: vi.fn(),
  countUsersByRoleAndStatus: vi.fn(),
  deleteUserRow: vi.fn(),
  emailExists: vi.fn(),
  insertUser: vi.fn(),
  listUsers: vi.fn()
}))

vi.mock('../../server/repositories/session.runtime.repository', () => ({
  deleteSessionsForUser: vi.fn()
}))

vi.mock('../../server/repositories/badge.repository', () => ({
  grantBadge,
  revokeBadge
}))

describe('admin user badge controls', () => {
  it('grants a badge without sending an empty user update', async () => {
    const { updateUser } = await import('../../server/modules/users/user.service')
    findUserById.mockResolvedValue({ id: 7, email: 'user@example.com', name: 'User', role: 'viewer', status: 'active', createdAt: '', updatedAt: '' })
    grantBadge.mockResolvedValue(undefined)

    await updateUser(7, { badgeKey: 'vip', badgeAction: 'grant' })

    expect(updateUserRow).not.toHaveBeenCalled()
    expect(grantBadge).toHaveBeenCalledWith({ userId: 7, badgeKey: 'vip', sourceType: 'admin' })
  })

  it('keeps the users.edit permission on the admin badge handler path', async () => {
    const handler = await readFile('server/api/admin/users/[id].put.ts', 'utf8')
    expect(handler).toContain('requirePermission(event, \'users.edit\')')
  })
})
