import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { compileScript, compileTemplate, parse } from '@vue/compiler-sfc'
import { ModuleKind, ScriptTarget, transpileModule } from 'typescript'
import { afterEach, describe, expect, it, vi } from 'vitest'

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

interface FetchOptions {
  query?: { page?: number }
  signal?: AbortSignal
}

interface MountedPicker {
  container: FakeElement
  props: { modelValue: number | null }
  emitted: ReturnType<typeof vi.fn>
  findButton: (text: string) => FakeElement
  unmount: () => void
}

type RenderFunction = (...args: unknown[]) => unknown
type SetupFunction = (props: Record<string, unknown>, context: {
  emit: (...args: unknown[]) => void
  expose: (exposed?: Record<string, unknown>) => void
}) => Record<string, unknown>
interface ComponentOptions {
  props: Record<string, unknown>
  emits: string[]
  setup: SetupFunction
}

class FakeNode {
  readonly childNodes: FakeNode[] = []
  parentNode: FakeElement | null = null
  readonly nodeType = 1

  appendChild<T extends FakeNode>(node: T): T {
    node.parentNode = this as unknown as FakeElement
    this.childNodes.push(node)
    return node
  }

  insertBefore<T extends FakeNode>(node: T, anchor: FakeNode | null): T {
    node.parentNode = this as unknown as FakeElement
    const index = anchor ? this.childNodes.indexOf(anchor) : -1
    if (index < 0) this.childNodes.push(node)
    else this.childNodes.splice(index, 0, node)
    return node
  }

  removeChild<T extends FakeNode>(node: T): T {
    const index = this.childNodes.indexOf(node)
    if (index >= 0) this.childNodes.splice(index, 1)
    node.parentNode = null
    return node
  }

  get firstChild(): FakeNode | null { return this.childNodes[0] ?? null }
  get nextSibling(): FakeNode | null {
    if (!this.parentNode) return null
    const index = this.parentNode.childNodes.indexOf(this)
    return this.parentNode.childNodes[index + 1] ?? null
  }

  get textContent(): string { return this.childNodes.map(node => node.textContent).join('') }
  set textContent(value: string) {
    this.childNodes.splice(0)
    if (value) this.appendChild(new FakeText(value))
  }
}

class FakeText extends FakeNode {
  readonly nodeType = 3
  constructor(private readonly value: string) { super() }
  override get textContent(): string { return this.value }
  override set textContent(_value: string) { /* immutable text node for Vue's text patch */ }
}

class FakeElement extends FakeNode {
  readonly nodeType = 1
  readonly attributes = new Map<string, string>()
  readonly listeners = new Map<string, Array<(event: Event) => void>>()
  readonly style = { cssText: '', setProperty: () => {}, removeProperty: () => {} }
  readonly classList = {
    add: (...names: string[]) => names.forEach(name => this.classes.add(name)),
    remove: (...names: string[]) => names.forEach(name => this.classes.delete(name)),
    toggle: (name: string, force?: boolean) => {
      const enabled = force ?? !this.classes.has(name)
      if (enabled) this.classes.add(name)
      else this.classes.delete(name)
      return enabled
    },
    contains: (name: string) => this.classes.has(name)
  }

  private readonly classes = new Set<string>()
  private _className = ''
  value = ''
  disabled = false
  type = ''
  src = ''
  alt = ''
  selectedIndex = -1

  constructor(readonly tagName: string, readonly ownerDocument: FakeDocument) { super() }

  set className(value: string) {
    this._className = value
    this.classes.clear()
    value.split(/\s+/).filter(Boolean).forEach(name => this.classes.add(name))
  }

  get className(): string { return this._className }
  get options(): FakeElement[] { return this.querySelectorAll('option') }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value)
    if (name === 'class') this.className = value
    if (name === 'src') this.src = value
    if (name === 'alt') this.alt = value
  }

  getAttribute(name: string): string | null { return this.attributes.get(name) ?? null }
  removeAttribute(name: string): void { this.attributes.delete(name) }
  addEventListener(name: string, handler: (event: Event) => void): void {
    this.listeners.set(name, [...(this.listeners.get(name) ?? []), handler])
  }

  removeEventListener(name: string, handler: (event: Event) => void): void {
    this.listeners.set(name, (this.listeners.get(name) ?? []).filter(item => item !== handler))
  }

  dispatchEvent(event: Event): boolean {
    for (const handler of this.listeners.get(event.type) ?? []) handler(event)
    return true
  }

  click(): void { this.dispatchEvent(new Event('click')) }
  querySelectorAll(selector: string): FakeElement[] {
    const result: FakeElement[] = []
    for (const child of this.childNodes) {
      if (child instanceof FakeElement) {
        if (child.matches(selector)) result.push(child)
        result.push(...child.querySelectorAll(selector))
      }
    }
    return result
  }

  querySelector(selector: string): FakeElement | null { return this.querySelectorAll(selector)[0] ?? null }
  private matches(selector: string): boolean {
    if (selector === '*') return true
    const tag = selector.match(/^[a-z]+/i)?.[0]
    return (!tag || this.tagName.toLowerCase() === tag.toLowerCase())
      && (!selector.includes('[type="button"]') || this.type === 'button')
  }

  override get textContent(): string { return super.textContent }
  override set textContent(value: string) { super.textContent = value }
}

class FakeDocument {
  readonly body = new FakeElement('body', this)
  createElement(tag: string): FakeElement { return new FakeElement(tag, this) }
  createElementNS(_namespace: string, tag: string): FakeElement { return this.createElement(tag) }
  createTextNode(value: string): FakeText { return new FakeText(value) }
  createComment(value: string): FakeText { return new FakeText(value) }
}

const testDocument = new FakeDocument()
const activeUnmounts = new Set<() => void>()

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

function abortError(): Error {
  const error = new Error('The operation was aborted')
  error.name = 'AbortError'
  return error
}

async function expectNoUnhandledRejection(action: () => Promise<void>): Promise<void> {
  const unhandled: unknown[] = []
  const handler = (reason: unknown) => unhandled.push(reason)
  process.on('unhandledRejection', handler)
  try {
    await action()
    await flushPromises()
    expect(unhandled).toEqual([])
  } finally {
    process.off('unhandledRejection', handler)
  }
}

async function flushPromises(): Promise<void> {
  await Promise.resolve()
  await Promise.resolve()
}

function pageResponse(total = 2): { items: MediaItem[], total: number } {
  return {
    items: [{ id: 1, filename: 'first-page.png', mime: 'image/png', url: '/media/1.png', folderId: null }],
    total
  }
}

function mediaResponse(id: number): MediaItem {
  return { id, filename: `selected-${id}.png`, mime: 'image/png', url: `/media/${id}.png`, folderId: null }
}

async function mountMediaPicker(
  modelValue: number | null,
  fetcher: (url: string, options?: FetchOptions) => Promise<unknown>
): Promise<MountedPicker> {
  const document = testDocument
  const window = { document }
  vi.stubGlobal('document', document)
  vi.stubGlobal('window', window)
  vi.stubGlobal('Element', FakeElement)
  vi.stubGlobal('HTMLElement', FakeElement)
  vi.stubGlobal('SVGElement', FakeElement)
  vi.stubGlobal('Node', FakeNode)

  const vue = await import('vue')
  const source = readFileSync(resolve(process.cwd(), 'app/admin/framework/MediaPickerField.vue'), 'utf8')
  const { descriptor, errors } = parse(source)
  if (errors.length > 0) throw new Error(String(errors[0]))
  const script = compileScript(descriptor, { id: 'media-picker-field-dom-test' })
  const scriptJavaScript = transpileModule(
    script.content.replace(/^import[^\n]+\n/gm, '').replace('export default', 'return'),
    { compilerOptions: { module: ModuleKind.None, target: ScriptTarget.ES2022 } }
  ).outputText
  const template = compileTemplate({
    source: descriptor.template?.content ?? '',
    filename: 'MediaPickerField.vue',
    id: 'media-picker-field-dom-test',
    compilerOptions: { mode: 'function' }
  })
  if (template.errors.length > 0) throw new Error(String(template.errors[0]))
  const render = new Function('Vue', template.code)(vue) as RenderFunction
  const createComponent = new Function(
    'ref', 'computed', 'onMounted', 'onBeforeUnmount', 'watch', '$fetch', 'useI18n', '_defineComponent', scriptJavaScript
  ) as (ref: typeof vue.ref, computed: typeof vue.computed, onMounted: typeof vue.onMounted,
    onBeforeUnmount: typeof vue.onBeforeUnmount, watch: typeof vue.watch, $fetch: typeof fetcher,
    useI18n: () => { t: (key: string) => string }, defineComponent: <T>(component: T) => T) => ComponentOptions
  const componentOptions = createComponent(
    vue.ref, vue.computed, vue.onMounted, vue.onBeforeUnmount, vue.watch, fetcher,
    () => ({ t: (key: string) => key }), vue.defineComponent
  ) as ComponentOptions
  const component = vue.defineComponent({
    props: componentOptions.props,
    emits: componentOptions.emits,
    setup: (props, context) => Object.assign({}, componentOptions.setup(props, context)),
    render
  })

  const props = vue.reactive({ modelValue })
  const emitted = vi.fn()
  const host = {
    setup: () => ({ props }),
    render(this: { props: { modelValue: number | null } }) {
      return vue.h(component, {
        'modelValue': this.props.modelValue,
        'onUpdate:modelValue': (value: number | null) => {
          emitted(value)
          this.props.modelValue = value
        }
      })
    }
  }
  const container = document.createElement('div')
  document.body.appendChild(container)
  const app = vue.createApp(host)
  app.mount(container)
  const unmount = () => {
    app.unmount()
    activeUnmounts.delete(unmount)
  }
  activeUnmounts.add(unmount)

  return {
    container,
    props,
    emitted,
    findButton: text => container.querySelectorAll('button').find(button => button.textContent.includes(text))!,
    unmount
  }
}

afterEach(() => {
  for (const unmount of activeUnmounts) unmount()
  testDocument.body.childNodes.splice(0)
  vi.unstubAllGlobals()
})

describe('MediaPickerField', () => {
  it('renders filename, src, and alt after loading an off-page selected media record', async () => {
    const page = deferred<{ items: MediaItem[], total: number }>()
    const detail = deferred<MediaItem>()
    const fetcher = vi.fn((url: string) => {
      if (url === '/api/admin/media') return page.promise
      if (url === '/api/admin/media/12') return detail.promise
      throw new Error(`Unexpected media request: ${url}`)
    })
    const mounted = await mountMediaPicker(12, fetcher)

    page.resolve(pageResponse())
    await flushPromises()
    detail.resolve(mediaResponse(12))
    await flushPromises()
    const image = mounted.container.querySelector('img')!

    expect(mounted.container.textContent).toContain('selected-12.png')
    expect(image.src).toBe('/media/12.png')
    expect(image.alt).toBe('selected-12.png')
    mounted.unmount()
  })

  it('uses the latest ID when the initial reload request is pending', async () => {
    const page = deferred<{ items: MediaItem[], total: number }>()
    const detail = deferred<MediaItem>()
    const fetcher = vi.fn((url: string) => {
      if (url === '/api/admin/media') return page.promise
      if (url === '/api/admin/media/13') return detail.promise
      throw new Error(`Unexpected media request: ${url}`)
    })
    const mounted = await mountMediaPicker(12, fetcher)

    mounted.props.modelValue = 13
    await flushPromises()
    page.resolve(pageResponse())
    await flushPromises()
    detail.resolve(mediaResponse(13))
    await flushPromises()

    expect(mounted.container.textContent).toContain('selected-13.png')
    expect(mounted.container.textContent).not.toContain('selected-12.png')
    mounted.unmount()
  })

  it('ignores a late detail response for the old ID', async () => {
    const page = deferred<{ items: MediaItem[], total: number }>()
    const oldDetail = deferred<MediaItem>()
    const newDetail = deferred<MediaItem>()
    let oldDetailSignal: AbortSignal | undefined
    const fetcher = vi.fn((url: string, options?: FetchOptions) => {
      if (url === '/api/admin/media') return page.promise
      if (url === '/api/admin/media/12') {
        oldDetailSignal = options?.signal
        return oldDetail.promise
      }
      if (url === '/api/admin/media/13') return newDetail.promise
      throw new Error(`Unexpected media request: ${url}`)
    })
    const mounted = await mountMediaPicker(12, fetcher)

    page.resolve(pageResponse())
    await flushPromises()
    mounted.props.modelValue = 13
    await flushPromises()
    expect(oldDetailSignal?.aborted).toBe(true)
    oldDetail.resolve(mediaResponse(12))
    await flushPromises()
    expect(mounted.container.textContent).not.toContain('selected-12.png')
    newDetail.resolve(mediaResponse(13))
    await flushPromises()
    expect(mounted.container.textContent).toContain('selected-13.png')
    mounted.unmount()
  })

  it('uses the latest ID when loadMore is pending', async () => {
    const initialPage = deferred<{ items: MediaItem[], total: number }>()
    const morePage = deferred<{ items: MediaItem[], total: number }>()
    const detail = deferred<MediaItem>()
    let pageOneCalls = 0
    const fetcher = vi.fn((url: string, options?: FetchOptions) => {
      if (url === '/api/admin/media' && options?.query?.page === 1) {
        pageOneCalls += 1
        return pageOneCalls === 1 ? initialPage.promise : Promise.resolve(pageResponse(3))
      }
      if (url === '/api/admin/media' && options?.query?.page === 2) return morePage.promise
      if (url === '/api/admin/media/13') return detail.promise
      if (url === '/api/admin/media/folders') return Promise.resolve({ items: [] })
      throw new Error(`Unexpected media request: ${url}`)
    })
    const mounted = await mountMediaPicker(null, fetcher)

    initialPage.resolve(pageResponse(3))
    await flushPromises()
    mounted.findButton('admin.mediaPicker.choose').click()
    await flushPromises()
    mounted.findButton('admin.mediaPicker.loadMore').click()
    mounted.props.modelValue = 13
    await flushPromises()
    morePage.resolve({ items: [{ ...mediaResponse(2), filename: 'second-page.png' }], total: 3 })
    await flushPromises()
    detail.resolve(mediaResponse(13))
    await flushPromises()

    expect(mounted.container.textContent).toContain('selected-13.png')
    mounted.unmount()
  })

  it('ignores page AbortError after unmount without an unhandled rejection', async () => {
    const page = deferred<{ items: MediaItem[], total: number }>()
    let pageSignal: AbortSignal | undefined
    const fetcher = vi.fn((url: string, options?: FetchOptions) => {
      if (url === '/api/admin/media') {
        pageSignal = options?.signal
        return page.promise
      }
      throw new Error(`Unexpected media request: ${url}`)
    })
    const mounted = await mountMediaPicker(12, fetcher)

    await expectNoUnhandledRejection(async () => {
      mounted.unmount()
      page.reject(abortError())
      await flushPromises()
    })

    expect(pageSignal?.aborted).toBe(true)
  })

  it('ignores detail AbortError when the ID is cleared and when unmounted', async () => {
    const page = deferred<{ items: MediaItem[], total: number }>()
    const detail = deferred<MediaItem>()
    let signal: AbortSignal | undefined
    const fetcher = vi.fn((url: string, options?: FetchOptions) => {
      if (url === '/api/admin/media') return page.promise
      if (url === '/api/admin/media/12') {
        signal = options?.signal
        return detail.promise
      }
      throw new Error(`Unexpected media request: ${url}`)
    })
    const mounted = await mountMediaPicker(12, fetcher)

    page.resolve(pageResponse())
    await flushPromises()
    await expectNoUnhandledRejection(async () => {
      mounted.props.modelValue = null
      await flushPromises()
      detail.reject(abortError())
      await flushPromises()
    })
    expect(signal?.aborted).toBe(true)
    mounted.unmount()
  })

  it('cancels a pending detail request independently during unmount', async () => {
    const page = deferred<{ items: MediaItem[], total: number }>()
    const detail = deferred<MediaItem>()
    let signal: AbortSignal | undefined
    const fetcher = vi.fn((url: string, options?: FetchOptions) => {
      if (url === '/api/admin/media') return page.promise
      if (url === '/api/admin/media/12') {
        signal = options?.signal
        return detail.promise
      }
      throw new Error(`Unexpected media request: ${url}`)
    })
    const mounted = await mountMediaPicker(12, fetcher)

    page.resolve(pageResponse())
    await flushPromises()
    expect(signal?.aborted).toBe(false)
    await expectNoUnhandledRejection(async () => {
      mounted.unmount()
      detail.reject(abortError())
      await flushPromises()
    })

    expect(signal?.aborted).toBe(true)
  })

  it('ignores a folder AbortError after picker unmount without an unhandled rejection', async () => {
    const folders = deferred<{ items: Array<{ id: number, name: string }> }>()
    let signal: AbortSignal | undefined
    const fetcher = vi.fn((url: string, options?: FetchOptions) => {
      if (url === '/api/admin/media') return Promise.resolve(pageResponse())
      if (url === '/api/admin/media/folders') {
        signal = options?.signal
        return folders.promise
      }
      throw new Error(`Unexpected media request: ${url}`)
    })
    const mounted = await mountMediaPicker(null, fetcher)

    await flushPromises()
    mounted.findButton('admin.mediaPicker.choose').click()
    await flushPromises()
    await expectNoUnhandledRejection(async () => {
      mounted.unmount()
      folders.reject(abortError())
      await flushPromises()
    })

    expect(signal?.aborted).toBe(true)
  })

  it('renders a controlled error when the initial page request fails', async () => {
    const page = deferred<{ items: MediaItem[], total: number }>()
    const fetcher = vi.fn((url: string) => {
      if (url === '/api/admin/media') return page.promise
      throw new Error(`Unexpected media request: ${url}`)
    })
    const mounted = await mountMediaPicker(null, fetcher)

    await expectNoUnhandledRejection(async () => {
      page.reject(new Error('media service unavailable'))
      await flushPromises()
    })

    expect(mounted.container.textContent).toContain('media service unavailable')
  })

  it('emits null from clear and a number from selecting a media button', async () => {
    const fetcher = vi.fn(async (url: string) => {
      if (url === '/api/admin/media/folders') return { items: [] }
      if (url === '/api/admin/media') return pageResponse()
      throw new Error(`Unexpected media request: ${url}`)
    })
    const mounted = await mountMediaPicker(1, fetcher)

    await flushPromises()
    mounted.findButton('common.cancel').click()
    expect(mounted.emitted).toHaveBeenNthCalledWith(1, null)
    await flushPromises()
    mounted.findButton('admin.mediaPicker.choose').click()
    await flushPromises()
    mounted.findButton('first-page.png').click()

    expect(mounted.emitted).toHaveBeenNthCalledWith(2, 1)
    mounted.unmount()
  })
})
