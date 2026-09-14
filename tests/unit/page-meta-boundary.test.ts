import { access, readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

describe('page meta boundaries', () => {
  it('keeps the localized home route as an alias of the root page', async () => {
    const source = await readFile('app/pages/index.vue', 'utf8')

    expect(source).toMatch(/definePageMeta\(\{[^}]*alias:\s*\[['"]\/en['"]\]/s)
    await expect(access('app/pages/[locale]/index.vue')).rejects.toThrow()
  })
})
