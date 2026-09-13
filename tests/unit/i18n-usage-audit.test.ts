import { mkdtemp, mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

import { auditI18nUsage } from '../../scripts/audit-i18n-usage'

const temporaryDirectories: string[] = []

async function createFixture(files: Record<string, string>): Promise<string> {
  const rootDir = await mkdtemp(join(tmpdir(), 'nuxtblog-i18n-audit-'))
  temporaryDirectories.push(rootDir)

  for (const [relativePath, content] of Object.entries(files)) {
    const filePath = join(rootDir, relativePath)
    await mkdir(join(filePath, '..'), { recursive: true })
    await writeFile(filePath, content, 'utf8')
  }

  return rootDir
}

afterEach(async () => {
  const { rm } = await import('node:fs/promises')
  await Promise.all(temporaryDirectories.splice(0).map(directory => rm(directory, { recursive: true, force: true })))
})

describe('auditI18nUsage', () => {
  it('collects static t and $t keys and reports unknown usages', async () => {
    const rootDir = await createFixture({
      'src/example.vue': `<template><span>{{ t('common.cancel') }}</span></template>
<script setup lang="ts">
const first = t('common.save')
const second = t("common.confirm")
const third = $t('common.cancel')
const missing = t('common.missing')
</script>`,
      'app/i18n/locales/zh-CN/common.ts': `export default { 'common.cancel': '取消', 'common.save': '保存', 'common.confirm': '确认' }`,
      'app/i18n/locales/en/common.ts': `export default { 'common.cancel': 'Cancel', 'common.save': 'Save', 'common.confirm': 'Confirm' }`
    })

    const report = await auditI18nUsage({ rootDir, sourceDirs: ['src'], localeDir: 'app/i18n/locales' })

    expect(report.staticUsages.map(usage => usage.key)).toEqual([
      'common.cancel',
      'common.save',
      'common.confirm',
      'common.cancel',
      'common.missing'
    ])
    expect(report.missingKeys).toEqual(['common.missing'])
    expect(report.hasErrors).toBe(true)
  })

  it('reports missing and extra keys for each locale', async () => {
    const rootDir = await createFixture({
      'src/empty.ts': 'export const ready = true',
      'app/i18n/locales/zh-CN/common.ts': `export default { 'shared.same': '相同', 'zh.only': '仅中文' }`,
      'app/i18n/locales/en/common.ts': `export default { 'shared.same': 'Same', 'en.only': 'Only English' }`
    })

    const report = await auditI18nUsage({ rootDir, sourceDirs: ['src'], localeDir: 'app/i18n/locales' })

    expect(report.localeDiffs).toEqual([
      { locale: 'en', missing: ['zh.only'], extra: ['en.only'] },
      { locale: 'zh-CN', missing: ['en.only'], extra: ['zh.only'] }
    ])
  })

  it('allows mapped dynamic keys but rejects arbitrary user-input concatenation', async () => {
    const rootDir = await createFixture({
      'src/example.ts': `const safe = t(\`status.${'${status}'}\`)
const unsafe = t('user.' + userInput)`,
      'app/i18n/locales/zh-CN/common.ts': `export default { 'status.active': '活跃' }`,
      'app/i18n/locales/en/common.ts': `export default { 'status.active': 'Active' }`
    })

    const report = await auditI18nUsage({
      rootDir,
      sourceDirs: ['src'],
      localeDir: 'app/i18n/locales',
      dynamicKeyAllowlist: { '`status.${status}`': ['status.active'] }
    })

    expect(report.dynamicKeyRisks).toHaveLength(1)
    expect(report.dynamicKeyRisks[0]?.expression).toBe('\'user.\' + userInput')
    expect(report.dynamicKeyRisks[0]?.reason).toMatch(/user input/i)
  })

  it('finds raw known keys and hardcoded template copy while ignoring permission metadata', async () => {
    const rootDir = await createFixture({
      'src/example.vue': `<template>
  <div>{{ 'common.cancel' }}</div>
  <div data-permission="users.view">{{ 'users.view' }}</div>
  <button>Save changes</button>
</template>`,
      'app/i18n/locales/zh-CN/common.ts': `export default { 'common.cancel': '取消', 'users.view': '查看用户' }`,
      'app/i18n/locales/en/common.ts': `export default { 'common.cancel': 'Cancel', 'users.view': 'View users' }`
    })

    const report = await auditI18nUsage({ rootDir, sourceDirs: ['src'], localeDir: 'app/i18n/locales' })

    expect(report.rawKeyRisks.map(risk => risk.key)).toEqual(['common.cancel'])
    expect(report.hardcodedCopyRisks.map(risk => risk.text)).toEqual(['Save changes'])
  })

  it('does not scan Vue attribute expressions as template copy', async () => {
    const rootDir = await createFixture({
      'src/example.vue': '<template>\n  <button :title="count > 0 ? \'Active\' : \'Idle\'" :class="items.map(item => item.label)">Save</button>\n</template>',
      'app/i18n/locales/zh-CN/common.ts': 'export default { \'common.save\': \'保存\' }',
      'app/i18n/locales/en/common.ts': 'export default { \'common.save\': \'Save\' }'
    })

    const report = await auditI18nUsage({ rootDir, sourceDirs: ['src'], localeDir: 'app/i18n/locales' })

    expect(report.hardcodedCopyRisks.map(risk => risk.text)).toEqual(['Save'])
  })
})
