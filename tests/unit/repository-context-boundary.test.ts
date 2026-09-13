import { afterEach, describe, expect, it, vi } from 'vitest'
import { createDomainRepositoryContext } from '../../server/repositories/domain-context'

const originalDbDriver = process.env.DB_DRIVER

async function loadRuntimeModules() {
  const [
    alias,
    aliasMysql,
    aliasPostgres,
    page,
    pageMysql,
    pagePostgres,
    post,
    postMysql,
    postPostgres,
    profile,
    profileMysql,
    profilePostgres,
    settings,
    settingsMysql,
    settingsPostgres
  ] = await Promise.all([
    import('../../server/repositories/alias.runtime.repository'),
    import('../../server/repositories/alias.mysql.repository'),
    import('../../server/repositories/alias.postgres.repository'),
    import('../../server/repositories/page.runtime.repository'),
    import('../../server/repositories/page.repository'),
    import('../../server/repositories/page.postgres.repository'),
    import('../../server/repositories/post.runtime.repository'),
    import('../../server/repositories/post.repository'),
    import('../../server/repositories/post.postgres.repository'),
    import('../../server/modules/profile/profile.runtime.service'),
    import('../../server/modules/profile/profile.service'),
    import('../../server/modules/profile/profile.postgres.service'),
    import('../../server/modules/settings/settings.runtime.service'),
    import('../../server/modules/settings/settings.service'),
    import('../../server/modules/settings/settings.postgres.service')
  ])

  return {
    alias: { runtime: alias, mysql: aliasMysql, postgres: aliasPostgres },
    page: { runtime: page, mysql: pageMysql, postgres: pagePostgres },
    post: { runtime: post, mysql: postMysql, postgres: postPostgres },
    profile: { runtime: profile, mysql: profileMysql, postgres: profilePostgres },
    settings: { runtime: settings, mysql: settingsMysql, postgres: settingsPostgres }
  }
}

afterEach(() => {
  vi.unstubAllEnvs()
  if (originalDbDriver === undefined) delete process.env.DB_DRIVER
  else process.env.DB_DRIVER = originalDbDriver
  vi.resetModules()
})

describe('repository context boundary', () => {
  it('injects the selected repository and transaction into the context', async () => {
    const mysqlRepository = { name: 'mysql' }
    const postgresRepository = { name: 'postgres' }
    let transactionCalls = 0

    const context = createDomainRepositoryContext({
      driver: 'postgres',
      repositories: { mysql: mysqlRepository, postgres: postgresRepository },
      transaction: async (repository, work) => {
        transactionCalls += 1
        return work(repository)
      }
    })

    expect(context.repository).toBe(postgresRepository)
    await expect(context.transaction?.(repository => Promise.resolve(repository.name))).resolves.toBe('postgres')
    expect(transactionCalls).toBe(1)
  })

  it.each([
    ['mysql', 'mysql'],
    ['postgres', 'postgres'],
    ['supabase', 'postgres'],
    ['memory', 'mysql'],
    [undefined, 'mysql']
  ] as const)('selects the adapter contract for DB_DRIVER=%s', async (driver, adapter) => {
    vi.resetModules()
    if (driver === undefined) delete process.env.DB_DRIVER
    else vi.stubEnv('DB_DRIVER', driver)

    const modules = await loadRuntimeModules()
    expect(modules.alias.runtime.findRedirect).toBe(modules.alias[adapter].findRedirect)
    expect(modules.page.runtime.listPages).toBe(modules.page[adapter].listPages)
    expect(modules.post.runtime.listPosts).toBe(modules.post[adapter].listPosts)
    expect(modules.profile.runtime.getProfileBundle).toBe(modules.profile[adapter].getProfileBundle)
    expect(modules.settings.runtime.listSettings).toBe(modules.settings[adapter].listSettings)
  })

  it('rejects an unknown driver consistently', () => {
    expect(() => createDomainRepositoryContext({ driver: 'sqlite' })).toThrow('Unsupported domain database driver')
  })
})
