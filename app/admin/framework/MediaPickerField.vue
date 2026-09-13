<template>
  <div class="space-y-2">
    <div
      v-if="selectedMedia"
      class="flex items-center gap-3 rounded-md border p-2"
    >
      <img
        :src="selectedMedia.url"
        :alt="selectedMedia.filename"
        class="h-14 w-20 rounded border object-cover"
      >
      <div class="min-w-0 flex-1">
        <p class="truncate text-sm">
          {{ selectedMedia.filename }}
        </p>
        <p class="text-xs text-muted-foreground">
          {{ selectedMedia.mime }}
        </p>
      </div>
      <button
        type="button"
        class="h-8 shrink-0 rounded-md border px-3 text-xs hover:bg-accent"
        :disabled="disabled"
        @click="openPicker"
      >
        {{ t('admin.mediaPicker.change') }}
      </button>
      <button
        type="button"
        class="h-8 shrink-0 rounded-md border border-destructive/40 px-3 text-xs text-destructive hover:bg-destructive/10"
        :disabled="disabled"
        @click="clear"
      >
        {{ t('common.cancel') }}
      </button>
    </div>

    <button
      v-else
      type="button"
      class="flex h-9 w-full items-center gap-2 rounded-md border border-input px-3 text-sm text-muted-foreground hover:bg-accent/50 disabled:opacity-50"
      :disabled="disabled"
      @click="openPicker"
    >
      {{ t('admin.mediaPicker.choose') }}
    </button>

    <p
      v-if="recommended"
      class="text-[10px] text-muted-foreground"
    >
      {{ recommended }}
    </p>

    <!-- 弹窗：媒体库网格 -->
    <div
      v-if="open"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      @click.self="open = false"
    >
      <div class="flex max-h-[85vh] w-full max-w-3xl flex-col rounded-lg border bg-background shadow-lg">
        <div class="flex items-center gap-3 border-b p-4">
          <h2 class="text-base font-semibold">
            {{ t('admin.mediaPicker.title') }}
          </h2>
          <input
            v-model="search"
            type="search"
            :placeholder="t('admin.mediaPicker.search')"
            class="ml-auto h-8 w-40 rounded-md border bg-background px-2 text-sm"
            @input="onSearch"
          >
          <label class="h-8 cursor-pointer rounded-md border px-3 text-sm leading-8 hover:bg-accent">
            {{ t('admin.mediaPicker.upload') }}
            <input
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp,application/pdf"
              class="sr-only"
              :disabled="uploading"
              @change="onUpload"
            >
          </label>
          <select
            v-model="folderFilter"
            class="h-8 rounded-md border bg-background px-2 text-sm"
            @change="reload"
          >
            <option :value="null">
              {{ t('admin.mediaPicker.allFolders') }}
            </option>
            <option
              v-for="folder in folders"
              :key="folder.id"
              :value="folder.id"
            >
              {{ folder.name }}
            </option>
          </select>
          <form
            class="flex items-center gap-1"
            @submit.prevent="createFolder"
          >
            <input
              v-model="newFolderName"
              :placeholder="t('res.media.library.newFolder')"
              class="h-8 w-28 rounded-md border bg-background px-2 text-xs"
            >
            <button
              type="submit"
              class="h-8 shrink-0 rounded-md border px-2 text-xs hover:bg-accent disabled:opacity-40"
              :disabled="!newFolderName.trim()"
            >
              +
            </button>
          </form>
          <button
            type="button"
            class="h-8 rounded-md border px-3 text-sm hover:bg-accent"
            @click="open = false"
          >
            ✕
          </button>
        </div>

        <div class="min-h-[200px] flex-1 overflow-y-auto p-4">
          <div
            v-if="loading"
            class="py-10 text-center text-sm text-muted-foreground"
          >
            {{ t('common.loading') }}
          </div>
          <div
            v-else-if="items.length === 0"
            class="py-10 text-center text-sm text-muted-foreground"
          >
            {{ t('admin.mediaPicker.empty') }}
          </div>
          <div class="grid grid-cols-3 gap-3 sm:grid-cols-5">
            <button
              v-for="item in items"
              :key="item.id"
              type="button"
              class="group overflow-hidden rounded-md border text-left transition-colors hover:border-primary"
              :class="modelValue === item.id ? 'border-primary ring-1 ring-primary' : ''"
              @click="select(item)"
            >
              <img
                v-if="item.mime.startsWith('image/')"
                :src="item.url"
                :alt="item.filename"
                class="aspect-square w-full object-cover"
              >
              <div
                v-else
                class="flex aspect-square w-full items-center justify-center bg-muted text-xs text-muted-foreground"
              >
                {{ item.mime }}
              </div>
              <p class="truncate px-1.5 py-1 text-xs text-muted-foreground">
                {{ item.filename }}
              </p>
            </button>
          </div>
          <button
            v-if="items.length < total"
            type="button"
            class="mt-4 h-9 w-full rounded-md border text-sm hover:bg-accent"
            :disabled="loading"
            @click="loadMore"
          >
            {{ t('admin.mediaPicker.loadMore') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from '~/admin/i18n'

interface MediaItem {
  id: number
  filename: string
  mime: string
  url: string
  folderId: number | null
}

interface MediaFolder {
  id: number
  name: string
}

const props = defineProps<{
  modelValue?: number | null
  disabled?: boolean
  /** usage context (media.txt S47): filters + auto-classifies uploads */
  usage?: string
  /** e.g. "1600x700 16:7" - shown as a hint under the trigger */
  recommended?: string
  /** folder preselected for browsing and uploads */
  defaultFolderId?: number | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: number | null]
}>()

const { t } = useI18n()

const open = ref(false)
const items = ref<MediaItem[]>([])
const folders = ref<MediaFolder[]>([])
const folderFilter = ref<number | null>(props.defaultFolderId ?? null)
const newFolderName = ref('')
const total = ref(0)
const page = ref(1)
const loading = ref(false)

const selectedMedia = computed(() => items.value.find(i => i.id === props.modelValue) ?? null)
const search = ref('')
const uploading = ref(false)
let searchTimer: ReturnType<typeof setTimeout> | null = null
let selectedMediaRequest: AbortController | null = null
let pageRequest: AbortController | null = null
let folderRequest: AbortController | null = null
let disposed = false

function isPositiveMediaId(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0
}

function isAbortError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'name' in error && error.name === 'AbortError'
}

async function rehydrateSelectedMedia(): Promise<void> {
  const mediaId = props.modelValue
  if (disposed || !isPositiveMediaId(mediaId) || selectedMedia.value) return

  selectedMediaRequest?.abort()
  const controller = new AbortController()
  selectedMediaRequest = controller
  try {
    const media = await $fetch<MediaItem>(`/api/admin/media/${mediaId}`, { signal: controller.signal })
    if (disposed || controller.signal.aborted || props.modelValue !== mediaId || items.value.some(item => item.id === mediaId)) return
    items.value = [media, ...items.value]
  } catch (error: unknown) {
    if (isAbortError(error)) return
    throw error
  } finally {
    if (selectedMediaRequest === controller) selectedMediaRequest = null
  }
}

function onSearch(): void {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    void reload()
  }, 300)
}

async function onUpload(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  uploading.value = true
  try {
    const body = new FormData()
    body.append('file', file)
    if (props.usage) body.append('usageType', props.usage)
    if (folderFilter.value) body.append('folderId', String(folderFilter.value))
    const created = await $fetch<{ id: number }>('/api/admin/media/upload', { method: 'POST', body })
    await reload()
    emit('update:modelValue', created.id)
    open.value = false
  } finally {
    uploading.value = false
    input.value = ''
  }
}

async function createFolder(): Promise<void> {
  const name = newFolderName.value.trim()
  if (!name) return
  try {
    const created = await $fetch<{ id: number }>('/api/admin/media/folders', {
      method: 'POST',
      body: { name }
    })
    newFolderName.value = ''
    await fetchFolders()
    folderFilter.value = created.id
    await reload()
  } catch (error: unknown) {
    if (isAbortError(error)) return
    throw error
  }
}

async function fetchFolders(): Promise<void> {
  if (disposed) return
  folderRequest?.abort()
  const controller = new AbortController()
  folderRequest = controller
  try {
    const res = await $fetch<{ items: MediaFolder[] }>('/api/admin/media/folders', {
      signal: controller.signal,
      query: { perPage: 100 }
    })
    if (!disposed && !controller.signal.aborted && folderRequest === controller) folders.value = res.items
  } catch (error: unknown) {
    if (isAbortError(error)) return
    throw error
  } finally {
    if (folderRequest === controller) folderRequest = null
  }
}

async function fetchPage(): Promise<boolean> {
  if (disposed) return false
  pageRequest?.abort()
  const controller = new AbortController()
  pageRequest = controller
  const requestedPage = page.value
  loading.value = true
  try {
    const res = await $fetch<{ items: MediaItem[], total: number }>('/api/admin/media', {
      signal: controller.signal,
      query: {
        page: page.value,
        perPage: 40,
        ...(search.value.trim() ? { q: search.value.trim() } : {}),
        ...(folderFilter.value ? { folderId: folderFilter.value } : {}),
        ...(props.usage ? { usageType: props.usage } : {})
      }
    })
    if (disposed || controller.signal.aborted || pageRequest !== controller) return false
    if (requestedPage === 1) items.value = res.items
    else items.value = [...items.value, ...res.items]
    total.value = res.total
    return true
  } catch (error: unknown) {
    if (isAbortError(error)) return false
    throw error
  } finally {
    if (pageRequest === controller) {
      pageRequest = null
      if (!disposed) loading.value = false
    }
  }
}

async function reload(): Promise<void> {
  page.value = 1
  if (!await fetchPage() || disposed) return
  await rehydrateSelectedMedia()
}

async function loadMore(): Promise<void> {
  if (disposed) return
  page.value += 1
  if (!await fetchPage() || disposed) return
  await rehydrateSelectedMedia()
}

async function openPicker(): Promise<void> {
  open.value = true
  await Promise.all([fetchFolders(), reload()])
}

onMounted(() => {
  void reload()
})

watch(() => props.modelValue, () => {
  if (disposed) return
  if (!isPositiveMediaId(props.modelValue)) {
    selectedMediaRequest?.abort()
    selectedMediaRequest = null
    return
  }
  selectedMediaRequest?.abort()
  selectedMediaRequest = null
  if (!loading.value) void rehydrateSelectedMedia()
})

onBeforeUnmount(() => {
  disposed = true
  pageRequest?.abort()
  pageRequest = null
  folderRequest?.abort()
  folderRequest = null
  selectedMediaRequest?.abort()
  selectedMediaRequest = null
  if (searchTimer) clearTimeout(searchTimer)
})

function select(item: MediaItem): void {
  emit('update:modelValue', item.id)
  open.value = false
}

function clear(): void {
  emit('update:modelValue', null)
}
</script>
