import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { compileScript, parse } from '@vue/compiler-sfc'
import { computed, nextTick, reactive, ref, watch } from 'vue'
import { ModuleKind, ScriptTarget, transpileModule } from 'typescript'
import { describe, expect, it, vi } from 'vitest'

interface MediaItem {
  id: number
  filename: string
  mime: string
  url: string
  folderId: number | null
}

interface Deferred<T> {
  promise: Promise<T>
  resolve: (value: T) => void
  reject: (reason?: unknown) => void
}

interface MediaPickerState {
  selectedMedia: { value: MediaItem | null }
  select: (item: MediaItem) => void
  clear: () => void
  loadMore: () => Promise<void>
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

async function flushPromises(): Promise<void> {
  await Promise.resolve()
  await nextTick()
  await Promise.resolve()
}

async function mountMediaPicker(
  modelValue: number | null,
  fetcher: (url: string, options?: { signal?: AbortSignal }) => Promise<unknown>
): Promise<{
  props: { modelValue: number | null }
  state: MediaPickerState
  mounted: () => void
  unmounted: () => void
  emit: ReturnType<typeof vi.fn>
}> {
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

  let mountedHook: (() => void) | undefined
  let unmountedHook: (() => void) | undefined
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
    onMounted: (hook: () => void) => void,
    onBeforeUnmount: (hook: () => void) => void,
    watch: typeof import('vue').watch,
    $fetch: (url: string, options?: { signal?: AbortSignal }) => Promise<unknown>,
    useI18n: () => { t: (key: string) => string },
    defineComponent: <T>(component: T) => T
  ) => { setup: (props: { modelValue: number | null }, context: { emit: typeof emit, expose: () => void }) => MediaPickerState }
  const props = reactive({ modelValue })
  const emit = vi.fn()
  const component = createComponent(
    ref,
    computed,
    (hook) => { mountedHook = hook },
    (hook) => { unmountedHook = hook },
    watch,
    fetcher,
    () => ({ t: key => key }),
    component => component
  )
  const state = component.setup(props, { emit, expose: () => {} })

  return {
    props,
    state,
    mounted: () => mountedHook?.(),
    unmounted: () => unmountedHook?.(),
    emit
  }
}

const pageItems: MediaItem[] = [
  { id: 1, filename: 'first-page.png', mime: 'image/png', url: '/media/1.png', folderId: null }
]

function pageResponse(): { items: MediaItem[], total: number } {
  return { items: pageItems, total: 2 }
}

function mediaResponse(id: number): MediaItem {
  return { id, filename: `selected-${id}.png`, mime: 'image/png', url: `/media/${id}.png`, folderId: null }
}

describe('MediaPickerField', () => {
  it('keeps the selected media visible when it is not in the current page', async () => {
    const page = deferred<{ items: MediaItem[], total: number }>()
    const detail = deferred<MediaItem>()
    const fetcher = vi.fn((url: string) => {
      if (url === '/api/admin/media') return page.promise
      if (url === '/api/admin/media/12') return detail.promise
      throw new Error(`Unexpected media request: ${url}`)
    })
    const mounted = await mountMediaPicker(12, fetcher)

    mounted.mounted()
    page.resolve(pageResponse())
    await flushPromises()
    detail.resolve(mediaResponse(12))
    await flushPromises()

    expect(mounted.state.selectedMedia.value?.filename).toBe('selected-12.png')
  })

  it('uses the latest modelValue after loadMore finishes', async () => {
    const page = deferred<{ items: MediaItem[], total: number }>()
    const more = deferred<{ items: MediaItem[], total: number }>()
    const detail = deferred<MediaItem>()
    const fetcher = vi.fn((url: string, options?: { signal?: AbortSignal, query?: { page?: number } }) => {
      if (url === '/api/admin/media' && options?.query?.page === 1) return page.promise
      if (url === '/api/admin/media' && options?.query?.page === 2) return more.promise
      if (url === '/api/admin/media/13') return detail.promise
      throw new Error(`Unexpected media request: ${url}`)
    })
    const mounted = await mountMediaPicker(null, fetcher)

    mounted.mounted()
    page.resolve({ items: pageItems, total: 3 })
    await flushPromises()
    const loadingMore = mounted.state.loadMore()
    mounted.props.modelValue = 13
    await nextTick()
    more.resolve({ items: [{ ...mediaResponse(2), filename: 'second-page.png' }], total: 3 })
    await flushPromises()
    detail.resolve(mediaResponse(13))
    await loadingMore
    await flushPromises()

    expect(fetcher).toHaveBeenCalledWith('/api/admin/media/13', expect.any(Object))
    expect(mounted.state.selectedMedia.value?.id).toBe(13)
  })

  it('ignores a late detail response for an old modelValue', async () => {
    const page = deferred<{ items: MediaItem[], total: number }>()
    const oldDetail = deferred<MediaItem>()
    const newDetail = deferred<MediaItem>()
    const fetcher = vi.fn((url: string) => {
      if (url === '/api/admin/media') return page.promise
      if (url === '/api/admin/media/12') return oldDetail.promise
      if (url === '/api/admin/media/13') return newDetail.promise
      throw new Error(`Unexpected media request: ${url}`)
    })
    const mounted = await mountMediaPicker(12, fetcher)

    mounted.mounted()
    page.resolve(pageResponse())
    await flushPromises()
    mounted.props.modelValue = 13
    await nextTick()
    oldDetail.resolve(mediaResponse(12))
    await flushPromises()
    expect(mounted.state.selectedMedia.value).toBeNull()
    newDetail.resolve(mediaResponse(13))
    await flushPromises()

    expect(mounted.state.selectedMedia.value?.id).toBe(13)
  })

  it('cancels selected-media loading when cleared or unmounted', async () => {
    const page = deferred<{ items: MediaItem[], total: number }>()
    const detail = deferred<MediaItem>()
    let detailSignal: AbortSignal | undefined
    const fetcher = vi.fn((url: string, options?: { signal?: AbortSignal }) => {
      if (url === '/api/admin/media') return page.promise
      if (url === '/api/admin/media/12') {
        detailSignal = options?.signal
        return detail.promise
      }
      throw new Error(`Unexpected media request: ${url}`)
    })
    const mounted = await mountMediaPicker(12, fetcher)

    mounted.mounted()
    page.resolve(pageResponse())
    await flushPromises()
    mounted.props.modelValue = null
    await nextTick()
    expect(detailSignal?.aborted).toBe(true)
    detail.resolve(mediaResponse(12))
    await flushPromises()
    expect(mounted.state.selectedMedia.value).toBeNull()

    const unmountPage = deferred<{ items: MediaItem[], total: number }>()
    const unmountDetail = deferred<MediaItem>()
    let unmountSignal: AbortSignal | undefined
    const unmountFetcher = vi.fn((url: string, options?: { signal?: AbortSignal }) => {
      if (url === '/api/admin/media') return unmountPage.promise
      if (url === '/api/admin/media/12') {
        unmountSignal = options?.signal
        return unmountDetail.promise
      }
      throw new Error(`Unexpected media request: ${url}`)
    })
    const unmountInstance = await mountMediaPicker(12, unmountFetcher)
    unmountInstance.mounted()
    unmountPage.resolve(pageResponse())
    await flushPromises()
    unmountInstance.unmounted()
    expect(unmountSignal?.aborted).toBe(true)
  })

  it('emits numeric IDs on select and null on clear', async () => {
    const mounted = await mountMediaPicker(null, async () => ({ items: [], total: 0 }))
    const item = mediaResponse(12)

    mounted.state.select(item)
    mounted.state.clear()

    expect(mounted.emit).toHaveBeenNthCalledWith(1, 'update:modelValue', 12)
    expect(mounted.emit).toHaveBeenNthCalledWith(2, 'update:modelValue', null)
  })
})
