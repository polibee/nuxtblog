import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { compileScript, parse } from '@vue/compiler-sfc'
import { computed, ref } from 'vue'
import { ModuleKind, ScriptTarget, transpileModule } from 'typescript'
import { describe, expect, it, vi } from 'vitest'

interface MediaItem {
  id: number
  filename: string
  mime: string
  url: string
  folderId: number | null
}

interface MediaPickerState {
  selectedMedia: { value: MediaItem | null }
}

async function mountMediaPicker(modelValue: number, fetcher: (url: string) => Promise<unknown>): Promise<MediaPickerState> {
  const source = readFileSync(resolve(process.cwd(), 'app/admin/framework/MediaPickerField.vue'), 'utf8')
  const { descriptor, errors } = parse(source)
  if (errors.length > 0) throw new Error(String(errors[0]))

  const script = compileScript(descriptor, { id: 'media-picker-field-test' })
  const executable = script.content
    .replace(/^import[^\n]+\n/gm, '')
    .replace('export default', 'return')
  const javascript = transpileModule(executable, {
    compilerOptions: { module: ModuleKind.None, target: ScriptTarget.ES2022 }
  }).outputText

  const mounted: Array<() => void | Promise<void>> = []
  const createComponent = new Function(
    'ref',
    'computed',
    'onMounted',
    'onBeforeUnmount',
    'watch',
    '$fetch',
    'useI18n',
    '_defineComponent',
    javascript
  ) as (
    ref: typeof import('vue').ref,
    computed: typeof import('vue').computed,
    onMounted: (hook: () => void | Promise<void>) => void,
    onBeforeUnmount: (hook: () => void) => void,
    watch: () => void,
    $fetch: (url: string) => Promise<unknown>,
    useI18n: () => { t: (key: string) => string },
    defineComponent: <T>(component: T) => T
  ) => { setup: (props: { modelValue: number }, context: { emit: () => void, expose: () => void }) => MediaPickerState }
  const component = createComponent(ref, computed, hook => mounted.push(hook), () => {}, () => {}, fetcher, () => ({ t: key => key }), component => component)
  const state = component.setup({ modelValue }, { emit: vi.fn(), expose: () => {} })

  await Promise.all(mounted.map(hook => hook()))
  return state
}

describe('MediaPickerField', () => {
  it('keeps the selected media visible when it is not in the current page', async () => {
    const fetcher = vi.fn(async (url: string) => {
      if (url === '/api/admin/media') {
        return {
          items: [{ id: 1, filename: 'first-page.png', mime: 'image/png', url: '/media/1.png', folderId: null }],
          total: 2
        }
      }
      if (url === '/api/admin/media/12') {
        return { id: 12, filename: 'selected-cover.png', mime: 'image/png', url: '/media/12.png', folderId: null }
      }
      throw new Error(`Unexpected media request: ${url}`)
    })

    const state = await mountMediaPicker(12, fetcher)

    expect(state.selectedMedia.value?.filename).toBe('selected-cover.png')
  })
})
