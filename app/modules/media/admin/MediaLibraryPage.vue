<template>
  <div class="grid gap-6 lg:grid-cols-[260px,1fr]">
    <!-- 分类面板：桌面端卡片化，小屏横向滚动 -->
    <aside class="min-w-0 space-y-3">
      <div class="flex items-center justify-between px-1">
        <div>
          <p class="text-sm font-semibold">
            {{ t('media.library.categories') }}
          </p>
          <p class="text-xs text-muted-foreground">
            {{ t('media.library.categoriesHint') }}
          </p>
        </div>
        <FolderIcon
          class="h-4 w-4 text-muted-foreground"
          aria-hidden="true"
        />
      </div>
      <div class="flex gap-2 overflow-x-auto pb-1 lg:grid lg:grid-cols-2 lg:overflow-visible">
        <button
          type="button"
          class="flex min-w-[132px] items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-sm transition-colors"
          :class="folderFilter === null ? 'bg-primary/10 font-medium text-primary' : 'hover:bg-accent'"
          @click="setFolder(null)"
        >
          <ImageIcon
            class="h-4 w-4 shrink-0"
            aria-hidden="true"
          />
          <span class="min-w-0 flex-1 truncate">{{ t('media.library.all') }}</span>
          <span class="text-xs text-muted-foreground">{{ total }}</span>
        </button>
        <button
          type="button"
          class="flex min-w-[132px] items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-sm transition-colors"
          :class="folderFilter === 0 ? 'bg-primary/10 font-medium text-primary' : 'hover:bg-accent'"
          @click="setFolder(0)"
        >
          <FolderOpenIcon
            class="h-4 w-4 shrink-0"
            aria-hidden="true"
          />
          <span class="min-w-0 flex-1 truncate">{{ t('media.library.uncategorized') }}</span>
        </button>
        <template
          v-for="folder in folders"
          :key="folder.id"
        >
          <form
            v-if="renamingId === folder.id"
            class="flex items-center gap-1 px-3 py-1"
            @submit.prevent="saveRename"
          >
            <input
              v-model="renamingName"
              class="h-8 min-w-0 flex-1 rounded-md border bg-background px-2 text-sm"
              autofocus
              @keydown.esc="renamingId = null"
            >
            <button
              type="submit"
              class="h-8 shrink-0 rounded-md border px-2 text-xs hover:bg-accent"
            >
              ✓
            </button>
          </form>
          <button
            v-else
            type="button"
            class="group flex min-w-[180px] items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-sm transition-colors"
            :class="folderFilter === folder.id ? 'bg-primary/10 font-medium text-primary' : 'hover:bg-accent'"
            @click="setFolder(folder.id)"
          >
            <FolderIcon
              class="h-4 w-4 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
            <span class="min-w-0 flex-1 truncate">{{ folder.name }}</span>
            <span class="text-xs text-muted-foreground">{{ folder.mediaCount }}</span>
            <span class="flex items-center gap-1">
              <span
                class="text-xs text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
                :title="t('media.library.renameFolder')"
                @click.stop="startRename(folder)"
              >✎</span>
              <span
                class="text-xs text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
                :title="t('media.library.deleteFolder')"
                @click.stop="removeFolder(folder)"
              >✕</span>
            </span>
          </button>
        </template>
      </div>

      <form
        class="flex gap-2 rounded-xl border border-dashed p-2"
        @submit.prevent="createFolder"
      >
        <input
          v-model="newFolderName"
          :placeholder="t('media.library.newFolder')"
          class="h-9 min-w-0 flex-1 rounded-lg border-0 bg-transparent px-2 text-sm outline-none ring-0"
        >
        <button
          type="submit"
          class="h-9 w-9 shrink-0 rounded-lg bg-primary text-sm text-primary-foreground hover:bg-primary/90"
        >
          +
        </button>
      </form>
    </aside>

    <!-- 右：媒体网格 -->
    <div class="space-y-4">
      <div class="flex flex-wrap items-center gap-2">
        <label class="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          {{ uploading ? t('common.saving') : t('media.library.upload') }}
          <input
            type="file"
            accept="image/png,image/jpeg,image/gif,image/webp,application/pdf"
            class="sr-only"
            :disabled="uploading"
            @change="onUpload"
          >
        </label>
        <input
          v-model="search"
          type="search"
          :placeholder="t('media.library.search')"
          class="h-9 w-44 rounded-md border bg-background px-3 text-sm"
          @input="onSearch"
        >
        <select
          v-model="usageFilter"
          class="h-9 rounded-md border bg-background px-2 text-sm"
          @change="reload"
        >
          <option value="">
            {{ t('media.library.usageAll') }}
          </option>
          <option
            v-for="usage in MEDIA_USAGE_TYPES"
            :key="usage"
            :value="usage"
          >
            {{ resolveAdminDisplayLabel(t, 'mediaUsageShort', usage) }}
          </option>
        </select>
        <select
          v-model="usedFilter"
          class="h-9 rounded-md border bg-background px-2 text-sm"
          @change="reload"
        >
          <option value="">
            {{ t('media.library.usedAll') }}
          </option>
          <option value="true">
            {{ t('media.library.used') }}
          </option>
          <option value="false">
            {{ t('media.library.unused') }}
          </option>
        </select>
        <label class="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
          <input
            v-model="missingAltFilter"
            type="checkbox"
            class="h-4 w-4"
            @change="reload"
          >
          {{ t('media.library.missingAlt') }}
        </label>
        <span class="ml-auto text-xs text-muted-foreground">
          {{ t('media.library.count', { n: total }) }}
        </span>
      </div>

      <p
        v-if="error"
        class="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive"
      >
        {{ error }}
      </p>

      <div
        v-if="loading"
        class="py-10 text-center text-sm text-muted-foreground"
      >
        {{ t('common.status.loading') }}
      </div>
      <div
        v-else-if="items.length === 0"
        class="rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground"
      >
        {{ t('media.library.empty') }}
      </div>

      <div class="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
        <div
          v-for="item in items"
          :key="item.id"
          class="overflow-hidden rounded-lg border bg-card"
        >
          <button
            type="button"
            class="group relative block w-full"
            @click="openDrawer(item)"
          >
            <img
              v-if="item.mime.startsWith('image/')"
              :src="variantUrl(item, 'thumbnail')"
              :alt="item.filename"
              loading="lazy"
              class="aspect-square w-full transition-transform group-hover:scale-105"
              :class="item.mime === 'image/jpeg' ? 'object-cover' : 'checkerboard object-contain'"
            >
            <div
              v-else
              class="flex aspect-square w-full items-center justify-center bg-muted text-xs text-muted-foreground"
            >
              {{ item.mime }}
            </div>
            <div class="absolute inset-0 hidden items-center justify-center bg-black/40 group-hover:flex">
              <span class="rounded-md bg-white/90 px-3 py-1 text-xs font-medium text-neutral-900">{{ t('media.library.detail') }}</span>
            </div>
          </button>
          <div class="space-y-1.5 p-3">
            <p
              class="truncate text-sm font-medium"
              :title="item.filename"
            >
              {{ item.filename }}
            </p>
            <p class="text-xs text-muted-foreground">
              <template v-if="item.width && item.height">
                {{ item.width }}×{{ item.height }} ·
              </template>{{ formatSize(item.size) }}
            </p>
          </div>
        </div>
      </div>

      <button
        v-if="items.length < total"
        type="button"
        class="h-9 w-full rounded-md border text-sm hover:bg-accent"
        :disabled="loading"
        @click="loadMore"
      >
        {{ t('media.library.loadMore') }}
      </button>
    </div>
  </div>

  <!-- 详情抽屉（media.txt §75）：管理信息，看大图另开 Lightbox -->
  <div
    v-if="drawer"
    class="fixed inset-0 z-50 flex justify-end bg-black/40"
    @click.self="drawer = null"
  >
    <div class="flex h-full w-full max-w-md flex-col overflow-y-auto border-l bg-background p-5">
      <div class="mb-3 flex items-start justify-between gap-2">
        <p
          class="min-w-0 truncate text-sm font-semibold"
          :title="drawer.filename"
        >
          {{ drawer.filename }}
        </p>
        <button
          type="button"
          class="h-7 w-7 shrink-0 rounded border text-xs hover:bg-accent"
          @click="drawer = null"
        >
          ✕
        </button>
      </div>

      <button
        type="button"
        class="checkerboard mb-3 block w-full overflow-hidden rounded-lg border"
        @click="openLightbox(drawer)"
      >
        <img
          v-if="drawer.mime.startsWith('image/')"
          :src="variantUrl(drawer, 'medium')"
          :alt="altOf(drawer)"
          class="max-h-72 w-full object-contain"
        >
        <div
          v-else
          class="flex h-40 items-center justify-center bg-muted text-sm text-muted-foreground"
        >
          {{ drawer.mime }}
        </div>
      </button>

      <dl class="mb-4 space-y-1 text-xs text-muted-foreground">
        <div
          v-if="drawer.width && drawer.height"
          class="flex justify-between"
        >
          <dt>{{ t('media.drawer.dimensions') }}</dt>
          <dd>{{ drawer.width }} × {{ drawer.height }}</dd>
        </div>
        <div class="flex justify-between">
          <dt>{{ t('media.drawer.size') }}</dt>
          <dd>{{ formatSize(drawer.size) }} · {{ drawer.mime.split('/')[1]?.toUpperCase() }}</dd>
        </div>
        <div class="flex justify-between">
          <dt>{{ t('media.drawer.uploaded') }}</dt>
          <dd>{{ new Date(drawer.createdAt).toLocaleDateString() }}</dd>
        </div>
      </dl>

      <div class="mb-4 grid grid-cols-2 gap-2">
        <label class="space-y-1 text-xs">
          <span class="text-muted-foreground">{{ t('media.library.folder') }}</span>
          <select
            v-model="drawer.folderId"
            class="h-8 w-full rounded-md border bg-background px-2 text-xs"
            @change="saveDrawerMeta()"
          >
            <option :value="null">
              {{ t('media.library.uncategorized') }}
            </option>
            <option
              v-for="folder in folders"
              :key="folder.id"
              :value="folder.id"
            >
              {{ folder.name }}
            </option>
          </select>
        </label>
        <label class="space-y-1 text-xs">
          <span class="text-muted-foreground">{{ t('media.drawer.usage') }}</span>
          <select
            v-model="drawer.usageType"
            class="h-8 w-full rounded-md border bg-background px-2 text-xs"
            @change="saveDrawerMeta()"
          >
            <option
              v-for="usage in MEDIA_USAGE_TYPES"
              :key="usage"
              :value="usage"
            >
              {{ resolveAdminDisplayLabel(t, 'mediaUsage', usage) }}
            </option>
          </select>
        </label>
      </div>

      <div class="mb-4 space-y-2">
        <p class="text-xs font-medium text-muted-foreground">
          {{ t('media.drawer.copy') }} ({{ drawerLocale }})
        </p>
        <input
          v-model="drawerAlt"
          :placeholder="t('media.drawer.alt')"
          maxlength="255"
          class="h-8 w-full rounded-md border bg-background px-2 text-xs"
        >
        <textarea
          v-model="drawerCaption"
          :placeholder="t('media.drawer.caption')"
          maxlength="500"
          rows="2"
          class="w-full rounded-md border bg-background px-2 py-1 text-xs"
        />
        <UiButton
          size="sm"
          variant="outline"
          @click="saveDrawerCopy"
        >
          {{ t('common.save') }}
        </UiButton>
      </div>

      <div class="mb-4">
        <p class="mb-1 text-xs font-medium text-muted-foreground">
          {{ t('media.drawer.usedBy') }}
        </p>
        <p
          v-if="drawerReferences === null"
          class="text-xs text-muted-foreground"
        >
          {{ t('common.status.loading') }}
        </p>
        <ul
          v-else-if="drawerReferences.length"
          class="space-y-0.5 text-xs"
        >
          <li
            v-for="(ref, i) in drawerReferences"
            :key="i"
            class="truncate"
          >
            <span class="rounded bg-muted px-1 py-0.5 text-[10px] uppercase">{{ ref.module }}</span>
            {{ ref.label }}
          </li>
        </ul>
        <p
          v-else
          class="text-xs text-[var(--success)]"
        >
          {{ t('media.drawer.notUsed') }}
        </p>
      </div>

      <div
        v-if="drawer.variants.length"
        class="mb-4"
      >
        <p class="mb-1 text-xs font-medium text-muted-foreground">
          {{ t('media.drawer.variants') }}
        </p>
        <ul class="space-y-0.5 text-xs text-muted-foreground">
          <li
            v-for="variant in drawer.variants"
            :key="variant.variant"
            class="flex justify-between"
          >
            <span>{{ variant.variant }} (webp)</span>
            <span>{{ variant.width }}×{{ variant.height }} · {{ formatSize(variant.size) }}</span>
          </li>
        </ul>
      </div>

      <div class="mt-auto flex flex-wrap gap-2 pt-2">
        <UiButton
          size="sm"
          @click="openLightbox(drawer)"
        >
          {{ t('media.library.preview') }}
        </UiButton>
        <UiButton
          size="sm"
          variant="outline"
          @click="copyUrl(drawer)"
        >
          {{ t('media.drawer.copyUrl') }}
        </UiButton>
        <UiButton
          size="sm"
          variant="outline"
          class="text-destructive"
          @click="removeItem(drawer)"
        >
          {{ t('common.delete') }}
        </UiButton>
      </div>
    </div>
  </div>

  <!-- 全屏 Lightbox（media.txt §95）：95vw/92vh + 缩放/平移/全屏/键盘 -->
  <div
    v-if="lightbox"
    ref="lightboxEl"
    class="fixed inset-0 z-[60] flex flex-col bg-black/95 outline-none"
    tabindex="0"
    @wheel.prevent="onWheel"
    @keydown.left.prevent="stepLightbox(-1)"
    @keydown.right.prevent="stepLightbox(1)"
    @keydown.esc.prevent="lightbox = null"
    @keydown="onKeydown"
  >
    <div class="flex items-center justify-between px-4 py-2 text-sm text-white/90">
      <span class="min-w-0 truncate">{{ lightbox.filename }}</span>
      <div class="flex items-center gap-1">
        <button
          type="button"
          class="rounded px-2 py-1 hover:bg-white/10"
          @click="zoomBy(0.8)"
        >
          −
        </button>
        <button
          type="button"
          class="rounded px-2 py-1 text-xs hover:bg-white/10"
          @click="resetZoom"
        >
          {{ Math.round(scale * 100) }}%
        </button>
        <button
          type="button"
          class="rounded px-2 py-1 hover:bg-white/10"
          @click="zoomBy(1.25)"
        >
          +
        </button>
        <button
          type="button"
          class="rounded px-2 py-1 text-xs hover:bg-white/10"
          @click="resetZoom"
        >
          {{ t('media.lightbox.fit') }}
        </button>
        <button
          type="button"
          class="rounded px-2 py-1 text-xs hover:bg-white/10"
          @click="toggleFullscreen"
        >
          {{ t('media.lightbox.fullscreen') }}
        </button>
        <a
          :href="lightbox.url"
          target="_blank"
          rel="noopener"
          class="rounded px-2 py-1 text-xs hover:bg-white/10"
        >
          {{ t('media.lightbox.download') }}
        </a>
        <button
          type="button"
          class="rounded px-2 py-1 hover:bg-white/10"
          @click="lightbox = null"
        >
          ✕
        </button>
      </div>
    </div>
    <div
      class="relative flex-1 overflow-hidden"
      @click.self="resetZoom"
      @dblclick="zoomBy(2)"
      @pointerdown="panStart"
      @pointermove="panMove"
      @pointerup="panEnd"
      @pointerleave="panEnd"
    >
      <img
        v-if="lightbox.mime.startsWith('image/')"
        :src="lightbox.url"
        :alt="lightbox.filename"
        class="absolute left-1/2 top-1/2 max-h-full max-w-full select-none object-contain"
        :style="lightboxStyle"
        draggable="false"
      >
      <div
        v-else
        class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white p-10 text-sm text-neutral-700"
      >
        {{ lightbox.mime }}
      </div>
    </div>
    <div class="flex items-center justify-center gap-4 px-4 py-2 text-sm text-white/90">
      <button
        type="button"
        class="rounded px-3 py-1 hover:bg-white/10"
        @click="stepLightbox(-1)"
      >
        ←
      </button>
      <span>{{ lightboxIndex + 1 }} / {{ items.length }}</span>
      <button
        type="button"
        class="rounded px-3 py-1 hover:bg-white/10"
        @click="stepLightbox(1)"
      >
        →
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { FolderIcon, FolderOpenIcon, ImageIcon } from 'lucide-vue-next'
import { useI18n } from '~/admin/i18n'
import { resolveAdminDisplayLabel } from '~/admin/i18n/display-label'
import { notify, notifyError } from '~/admin/notifications/notify'
import { onAdminEvent } from '~/admin/core/events'
import { MEDIA_USAGE_TYPES } from '#shared/schemas/media'

interface MediaVariant {
  variant: string
  url: string
  width: number | null
  height: number | null
  size: number
  format: string
}

interface MediaItem {
  id: number
  filename: string
  mime: string
  size: number
  width: number | null
  height: number | null
  url: string
  folderId: number | null
  usageType: string
  createdAt: string
  translations: Record<string, { alt?: string, caption?: string }>
  variants: MediaVariant[]
}

interface MediaFolder {
  id: number
  name: string
  mediaCount: number
}

interface MediaReference {
  module: string
  label: string
}

const { t } = useI18n()

const items = ref<MediaItem[]>([])
const folders = ref<MediaFolder[]>([])
const folderFilter = ref<number | null>(null)
const search = ref('')
const usageFilter = ref('')
const usedFilter = ref('')
const missingAltFilter = ref(false)
const total = ref(0)
const page = ref(1)
const perPage = 40
const loading = ref(false)
const uploading = ref(false)
const error = ref('')
const newFolderName = ref('')
const renamingId = ref<number | null>(null)
const renamingName = ref('')

function startRename(folder: MediaFolder): void {
  renamingId.value = folder.id
  renamingName.value = folder.name
}

async function saveRename(): Promise<void> {
  const id = renamingId.value
  const name = renamingName.value.trim()
  if (!id || !name) {
    renamingId.value = null
    return
  }
  try {
    await $fetch(`/api/admin/media/folders/${id}`, { method: 'PUT', body: { name } })
    const folder = folders.value.find(f => f.id === id)
    if (folder) folder.name = name
    notify(t('res.slider.saved'))
  } catch (e) {
    error.value = (e as Error).message
  }
  renamingId.value = null
}

/* drawer state */
const drawer = ref<MediaItem | null>(null)
const drawerReferences = ref<MediaReference[] | null>(null)
const drawerAlt = ref('')
const drawerCaption = ref('')
const drawerLocale = ref('zh-CN')

/* lightbox state */
const lightbox = ref<MediaItem | null>(null)
const lightboxEl = ref<HTMLElement | null>(null)
const lightboxIndex = computed(() => items.value.findIndex(i => i.id === lightbox.value?.id))
const scale = ref(1)
const panX = ref(0)
const panY = ref(0)
let panning: { x: number, y: number, baseX: number, baseY: number } | null = null

const lightboxStyle = computed(() => ({
  transform: `translate(calc(-50% + ${panX.value}px), calc(-50% + ${panY.value}px)) scale(${scale.value})`
}))

function variantUrl(item: MediaItem, variant: string): string {
  return item.variants.find(v => v.variant === variant)?.url ?? item.url
}

function altOf(item: MediaItem): string {
  return Object.values(item.translations).find(tr => tr.alt)?.alt || item.filename
}

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + ' MB'
  return Math.max(Math.round(bytes / 1024), 1) + ' KB'
}

let searchTimer: ReturnType<typeof setTimeout> | null = null

async function fetchMedia(): Promise<void> {
  loading.value = true
  try {
    const res = await $fetch<{ items: MediaItem[], total: number }>('/api/admin/media', {
      query: {
        page: page.value,
        perPage,
        q: search.value.trim() || undefined,
        folderId: folderFilter.value ?? undefined,
        usageType: usageFilter.value || undefined,
        used: usedFilter.value || undefined,
        missingAlt: missingAltFilter.value ? 'true' : undefined
      }
    })
    if (page.value === 1) items.value = res.items
    else items.value = [...items.value, ...res.items]
    total.value = res.total
    error.value = ''
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    loading.value = false
  }
}

async function fetchFolders(): Promise<void> {
  try {
    const res = await $fetch<{ items: MediaFolder[] }>('/api/admin/media/folders', { query: { perPage: 100 } })
    folders.value = res.items
  } catch {
    folders.value = []
  }
}

async function refreshAll(): Promise<void> {
  page.value = 1
  await Promise.all([fetchMedia(), fetchFolders()])
}

function reload(): void {
  page.value = 1
  void fetchMedia()
}

function setFolder(id: number | null): void {
  folderFilter.value = id
  reload()
}

function onSearch(): void {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(reload, 300)
}

function loadMore(): void {
  page.value += 1
  void fetchMedia()
}

async function onUpload(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const files = Array.from(input.files ?? [])
  if (files.length === 0) return
  uploading.value = true
  try {
    for (const file of files) {
      const body = new FormData()
      body.append('file', file)
      const created = await $fetch<{ duplicateOf: number | null }>('/api/admin/media/upload', { method: 'POST', body })
      if (created.duplicateOf) {
        notify(t('media.library.duplicate', { id: created.duplicateOf }))
      }
    }
    await refreshAll()
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    uploading.value = false
    input.value = ''
  }
}

async function createFolder(): Promise<void> {
  const name = newFolderName.value.trim()
  if (!name) return
  try {
    await $fetch('/api/admin/media/folders', { method: 'POST', body: { name } })
    newFolderName.value = ''
    await fetchFolders()
  } catch (e) {
    error.value = (e as Error).message
  }
}

async function removeFolder(folder: MediaFolder): Promise<void> {
  if (!confirm(t('media.library.deleteFolderConfirm', { name: folder.name }))) return
  try {
    await $fetch(`/api/admin/media/folders/${folder.id}`, { method: 'DELETE' })
    if (folderFilter.value === folder.id) folderFilter.value = null
    await refreshAll()
  } catch (e) {
    error.value = (e as Error).message
  }
}

/* ---------- drawer ---------- */

async function openDrawer(item: MediaItem): Promise<void> {
  drawer.value = item
  drawerReferences.value = null
  drawerAlt.value = item.translations[drawerLocale.value]?.alt ?? ''
  drawerCaption.value = item.translations[drawerLocale.value]?.caption ?? ''
  try {
    const res = await $fetch<{ references: MediaReference[] }>(`/api/admin/media/${item.id}/references`)
    drawerReferences.value = res.references
  } catch {
    drawerReferences.value = []
  }
}

async function saveDrawerMeta(): Promise<void> {
  const item = drawer.value
  if (!item) return
  try {
    await $fetch(`/api/admin/media/${item.id}`, {
      method: 'PUT',
      body: { folderId: item.folderId, usageType: item.usageType }
    })
    notify(t('media.messages.saved'))
  } catch (e) {
    notifyError(t('media.library.moveFailed'), (e as Error).message)
  }
}

/* merge with existing locales so editing one locale never wipes others */
async function saveDrawerCopy(): Promise<void> {
  const item = drawer.value
  if (!item) return
  const translations: Record<string, { alt: string, caption: string }> = {}
  for (const [code, tr] of Object.entries(item.translations)) {
    translations[code] = { alt: tr.alt ?? '', caption: tr.caption ?? '' }
  }
  translations[drawerLocale.value] = { alt: drawerAlt.value, caption: drawerCaption.value }
  try {
    const updated = await $fetch<MediaItem>(`/api/admin/media/${item.id}`, {
      method: 'PUT',
      body: { translations }
    })
    item.translations = updated.translations
    notify(t('media.messages.saved'))
  } catch (e) {
    notifyError(t('media.messages.saveFailed'), (e as Error).message)
  }
}

async function removeItem(item: MediaItem): Promise<void> {
  if (!confirm(t('media.library.deleteConfirm', { name: item.filename }))) return
  try {
    await $fetch(`/api/admin/media/${item.id}`, { method: 'DELETE' })
    drawer.value = null
    await refreshAll()
  } catch (e) {
    const err = e as Error & { data?: { references?: MediaReference[] } }
    if (err.data?.references?.length) {
      const list = err.data.references.map(r => `• ${r.module}: ${r.label}`).join('\n')
      error.value = t('media.library.inUse', { list })
    } else {
      error.value = err.message
    }
  }
}

async function copyUrl(item: MediaItem): Promise<void> {
  try {
    await navigator.clipboard.writeText(`${window.location.origin}${item.url}`)
    notify(t('media.drawer.copied'))
  } catch {
    notifyError(t('media.drawer.copied'), item.url)
  }
}

/* ---------- lightbox ---------- */

function openLightbox(item: MediaItem): void {
  lightbox.value = item
  scale.value = 1
  panX.value = 0
  panY.value = 0
  nextTick(() => lightboxEl.value?.focus())
}

function stepLightbox(direction: -1 | 1): void {
  if (items.value.length === 0) return
  const index = lightboxIndex.value
  const next = (index + direction + items.value.length) % items.value.length
  lightbox.value = items.value[next]!
  scale.value = 1
  panX.value = 0
  panY.value = 0
}

function onKeydown(e: KeyboardEvent): void {
  if (e.key === '+') zoomBy(1.25)
  else if (e.key === '-') zoomBy(0.8)
}

function zoomBy(factor: number): void {
  scale.value = Math.min(Math.max(scale.value * factor, 0.25), 6)
}

function resetZoom(): void {
  scale.value = 1
  panX.value = 0
  panY.value = 0
}

function onWheel(e: WheelEvent): void {
  zoomBy(e.deltaY < 0 ? 1.1 : 0.9)
}

function panStart(e: PointerEvent): void {
  panning = { x: e.clientX, y: e.clientY, baseX: panX.value, baseY: panY.value }
}
function panMove(e: PointerEvent): void {
  if (!panning) return
  panX.value = panning.baseX + (e.clientX - panning.x)
  panY.value = panning.baseY + (e.clientY - panning.y)
}
function panEnd(): void {
  panning = null
}

async function toggleFullscreen(): Promise<void> {
  try {
    if (document.fullscreenElement) await document.exitFullscreen()
    else await document.documentElement.requestFullscreen()
  } catch {
    /* fullscreen may be blocked */
  }
}

onMounted(async () => {
  await refreshAll()
  try {
    const res = await $fetch<{ locales: Array<{ code: string, isDefault: boolean }> }>('/api/public/locales')
    drawerLocale.value = res.locales.find(l => l.isDefault)?.code ?? res.locales[0]?.code ?? 'zh-CN'
  } catch {
    /* keep default */
  }
})

defineExpose({ refreshAll })

// framework expects pages.list to expose a refresh path; media:refresh triggers reload
onAdminEvent('media:refresh', () => void refreshAll())
</script>

<style scoped>
.checkerboard {
  background-image:
    linear-gradient(45deg, #ddd 25%, transparent 25%),
    linear-gradient(-45deg, #ddd 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #ddd 75%),
    linear-gradient(-45deg, transparent 75%, #ddd 75%);
  background-size: 16px 16px;
  background-position: 0 0, 0 8px, 8px -8px, -8px 0;
}
</style>
