import { describe, expect, it, vi } from 'vitest'
import { maskSettingValue } from '../../server/modules/settings/settings.service'

const { createSettingMock, requirePermissionMock } = vi.hoisted(() => ({
  createSettingMock: vi.fn(),
  requirePermissionMock: vi.fn()
}))

vi.mock('../../server/modules/settings/settings.runtime.service', () => ({
  createSetting: createSettingMock
}))

vi.mock('../../server/utils/auth', () => ({
  requirePermission: requirePermissionMock
}))

type TestEvent = { body: unknown }
type TestHandler = (event: TestEvent) => unknown | Promise<unknown>

const nuxtGlobals = globalThis as typeof globalThis & {
  defineEventHandler: (handler: TestHandler) => TestHandler
  readBody: (event: TestEvent) => Promise<unknown>
}

nuxtGlobals.defineEventHandler = handler => handler
nuxtGlobals.readBody = async event => event.body

const { default: createSettingHandler } = await import('../../server/api/admin/settings/index.post')
const invokeCreateSetting = createSettingHandler as unknown as TestHandler

describe('settings secret views', () => {
  it('masks secret values while preserving the last four characters', () => {
    expect(maskSettingValue('fixture-secret', 'secret')).toBe('••••cret')
  })

  it('does not alter non-secret values', () => {
    expect(maskSettingValue('enabled', 'string')).toBe('enabled')
  })

  it('masks secret values in the create response without altering the stored value', async () => {
    const created = {
      id: 7,
      key: 'API_TOKEN',
      value: 'fixture-secret',
      type: 'secret' as const,
      group: 'General',
      public: false
    }
    createSettingMock.mockResolvedValueOnce(created)

    const response = await invokeCreateSetting({
      body: { key: created.key, value: created.value, type: created.type }
    })

    expect(createSettingMock).toHaveBeenCalledWith({
      key: created.key,
      value: created.value,
      type: created.type
    })
    expect(response).toEqual({ ...created, value: '••••cret' })
    expect(created.value).toBe('fixture-secret')
  })
})
