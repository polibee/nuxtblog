import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..')

interface DirectDatabaseFinding {
  file: string
  line: number
  rule: 'database-import' | 'getDb-call'
}

function listTypeScriptFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) return listTypeScriptFiles(path)
    return entry.isFile() && path.endsWith('.ts') ? [path] : []
  })
}

function findDirectDatabaseDependencies(directory: string): DirectDatabaseFinding[] {
  return listTypeScriptFiles(directory).flatMap((file) => {
    const lines = readFileSync(file, 'utf8').split('\n')
    return lines.flatMap((content, index) => {
      const findings: DirectDatabaseFinding[] = []
      if (/repositories\/(?:db(?:-postgres)?\.server|schema(?:-postgres)?(?:\/|['"]))/.test(content)) {
        findings.push({ file: relative(repositoryRoot, file).replaceAll('\\', '/'), line: index + 1, rule: 'database-import' })
      }
      if (/\bget(?:Postgres)?Db\s*\(/.test(content)) {
        findings.push({ file: relative(repositoryRoot, file).replaceAll('\\', '/'), line: index + 1, rule: 'getDb-call' })
      }
      return findings
    })
  })
}

const contextEntrypoints = [
  'server/repositories/alias.runtime.repository.ts',
  'server/repositories/page.runtime.repository.ts',
  'server/repositories/post.runtime.repository.ts',
  'server/modules/profile/profile.runtime.service.ts',
  'server/modules/settings/settings.runtime.service.ts'
]

describe('repository context boundary', () => {
  it('reports direct schema and getDb dependencies still present in API/service layers', () => {
    const findings = [
      ...findDirectDatabaseDependencies(resolve(repositoryRoot, 'server/api')),
      ...findDirectDatabaseDependencies(resolve(repositoryRoot, 'server/modules'))
    ]

    expect(findings.length).toBeGreaterThan(0)
    expect(findings).toEqual(expect.arrayContaining([
      expect.objectContaining({ file: 'server/api/public/advertising/slots.get.ts', rule: 'database-import' }),
      expect.objectContaining({ file: 'server/modules/advertising/ad-purchase.service.ts', rule: 'getDb-call' })
    ]))
  })

  it('uses DomainRepositoryContext for the staged runtime entrypoints', () => {
    for (const entrypoint of contextEntrypoints) {
      const source = readFileSync(resolve(repositoryRoot, entrypoint), 'utf8')
      expect(source, entrypoint).toContain('createDomainRepositoryContext')
      expect(source, entrypoint).not.toMatch(/process\.env\.DB_DRIVER\s*===/)
    }
  })

  it('keeps transaction, pagination, time, and insert-id mapping in adapters', () => {
    const pageRepository = readFileSync(resolve(repositoryRoot, 'server/repositories/page.repository.ts'), 'utf8')
    const postRepository = readFileSync(resolve(repositoryRoot, 'server/repositories/post.repository.ts'), 'utf8')
    const advertisingRepository = readFileSync(resolve(repositoryRoot, 'server/repositories/advertising.repository.ts'), 'utf8')
    const mysqlLocaleRepository = readFileSync(resolve(repositoryRoot, 'server/repositories/locale.repository.ts'), 'utf8')
    const postgresLocaleRepository = readFileSync(resolve(repositoryRoot, 'server/repositories/locale.postgres.repository.ts'), 'utf8')

    expect(pageRepository).toMatch(/getDb\(\)\.transaction\(async \(tx\)/)
    expect(postRepository).toMatch(/getDb\(\)\.transaction\(async \(tx\)/)
    expect(pageRepository).toMatch(/totalPages/)
    expect(postRepository).toMatch(/totalPages/)
    expect(advertisingRepository).toMatch(/now\s*=\s*new Date\(\)/)
    expect(mysqlLocaleRepository).toMatch(/return row\.insertId/)
    expect(postgresLocaleRepository).toMatch(/return row\.id/)
  })
})
