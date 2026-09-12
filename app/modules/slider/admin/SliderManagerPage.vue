<script setup lang="ts">
import MediaPickerField from '~/admin/framework/MediaPickerField.vue'

/* Slider manager (P19): per-slider settings + drag & drop slide list.
   Slide status (active/scheduled/expired/disabled) is computed at
   runtime from enabled + starts_at/ends_at, matching the server. */

defineProps<{ resource: { name: string } }>()

const { t } = useI18n()

interface AdminSlider {
  id: number
  key: string
  name: string
  enabled: boolean
  autoplay: boolean
  intervalMs: number
  transition: 'slide' | 'fade'
  showArrows: boolean
  showIndicators: boolean
  pauseOnHover: boolean
  sortOrder: number
  itemCount: number
}

interface ItemTranslation {
  title: string
  description: string
  buttonText: string
  linkUrl: string
  altText: string
}

interface AdminSliderItem {
  id: number
  imageMediaId: number
  mobileImageMediaId: number | null
  linkUrl: string | null
  linkTarget: 'self' | 'blank'
  enabled: boolean
  startsAt: string | null
  endsAt: string | null
  sortOrder: number
  translations: Record<string, ItemTranslation>
  imageUrl: string | null
  mobileImageUrl: string | null
}

const sliders = ref<AdminSlider[]>([])
const selectedId = ref<number | null>(null)
const slider = ref<AdminSlider | null>(null)
const items = ref<AdminSliderItem[]>([])
const loading = ref(false)
const saving = ref(false)
const newKey = ref('')
const newName = ref('')

async function loadSliders(): Promise<void> {
  const res = await $fetch<{ items: AdminSlider[] }>('/api/admin/sliders')
  sliders.value = res.items
  if (!sliders.value.some(s => s.id === selectedId.value)) {
    selectedId.value = sliders.value[0]?.id ?? null
  }
}

async function loadSlider(): Promise<void> {
  if (!selectedId.value) {
    slider.value = null
    items.value = []
    return
  }
  loading.value = true
  try {
    const [info, list] = await Promise.all([
      $fetch<AdminSlider>(`/api/admin/sliders/${selectedId.value}`),
      $fetch<{ items: AdminSliderItem[] }>(`/api/admin/sliders/${selectedId.value}/items`)
    ])
    slider.value = info
    items.value = list.items
  } finally {
    loading.value = false
  }
}

async function createSlider(): Promise<void> {
  const key = newKey.value.trim()
  const name = newName.value.trim() || key
  if (!key) return
  try {
    const created = await $fetch<AdminSlider>('/api/admin/sliders', {
      method: 'POST',
      body: { key, name }
    })
    newKey.value = ''
    newName.value = ''
    await loadSliders()
    selectedId.value = created.id
    await loadSlider()
    notify(t('res.slider.saved'))
  } catch (e: unknown) {
    notifyError(t('res.slider.saveFailed'), (e as Error).message)
  }
}

/* settings toggles apply immediately — no separate save needed */
async function patchSetting(patch: Partial<AdminSlider>): Promise<void> {
  if (!slider.value || saving.value) return
  Object.assign(slider.value, patch)
  await saveSettings()
}

async function saveSettings(): Promise<void> {
  if (!slider.value) return
  saving.value = true
  try {
    const { id, itemCount, ...payload } = slider.value
    await $fetch(`/api/admin/sliders/${id}`, { method: 'PUT', body: payload })
    notify(t('res.slider.saved'))
    await loadSliders()
  } catch (e: unknown) {
    notifyError(t('res.slider.saveFailed'), (e as Error).message)
  } finally {
    saving.value = false
  }
}

async function deleteSlider(): Promise<void> {
  if (!slider.value || !window.confirm(t('res.slider.deleteSliderConfirm'))) return
  try {
    await $fetch(`/api/admin/sliders/${slider.value.id}`, { method: 'DELETE' })
    selectedId.value = null
    await loadSliders()
    await loadSlider()
  } catch (e: unknown) {
    notifyError(t('res.slider.saveFailed'), (e as Error).message)
  }
}

/* ---------- slide status (runtime, mirrors slider.service) ---------- */

type SlideStatus = 'active' | 'scheduled' | 'expired' | 'disabled'

function statusOf(item: AdminSliderItem): SlideStatus {
  if (!item.enabled) return 'disabled'
  const now = Date.now()
  if (item.startsAt && new Date(item.startsAt).getTime() > now) return 'scheduled'
  if (item.endsAt && new Date(item.endsAt).getTime() < now) return 'expired'
  return 'active'
}

const statusStyles: Record<SlideStatus, string> = {
  active: 'text-[var(--success)]',
  scheduled: 'text-warning',
  expired: 'text-destructive',
  disabled: 'text-muted-foreground'
}

/* ---------- drag & drop reorder ---------- */

const dragId = ref<number | null>(null)

function onDragStart(item: AdminSliderItem): void {
  dragId.value = item.id
}
function onDragOver(e: DragEvent): void {
  e.preventDefault()
}
async function onDrop(target: AdminSliderItem): Promise<void> {
  const dragged = dragId.value
  dragId.value = null
  if (dragged === null || dragged === target.id) return
  const list = [...items.value]
  const from = list.findIndex(i => i.id === dragged)
  const to = list.findIndex(i => i.id === target.id)
  if (from < 0 || to < 0) return
  const [moved] = list.splice(from, 1)
  list.splice(to, 0, moved!)
  items.value = list
  try {
    await $fetch(`/api/admin/sliders/${slider.value?.id}/items/reorder`, {
      method: 'POST',
      body: { ids: list.map(i => i.id) }
    })
  } catch (e: unknown) {
    notifyError(t('res.slider.saveFailed'), (e as Error).message)
    await loadSlider()
  }
}

async function moveItem(item: AdminSliderItem, direction: -1 | 1): Promise<void> {
  const index = items.value.findIndex(i => i.id === item.id)
  const target = index + direction
  if (index < 0 || target < 0 || target >= items.value.length) return
  const list = [...items.value]
  const [moved] = list.splice(index, 1)
  list.splice(target, 0, moved!)
  items.value = list
  try {
    await $fetch(`/api/admin/sliders/${slider.value?.id}/items/reorder`, {
      method: 'POST',
      body: { ids: list.map(i => i.id) }
    })
  } catch {
    await loadSlider()
  }
}

async function deleteItem(item: AdminSliderItem): Promise<void> {
  if (!window.confirm(t('res.slider.deleteSlideConfirm'))) return
  try {
    await $fetch(`/api/admin/sliders/${slider.value?.id}/items/${item.id}`, { method: 'DELETE' })
    await loadSlider()
  } catch (e: unknown) {
    notifyError(t('res.slider.saveFailed'), (e as Error).message)
  }
}

/* ---------- slide editor ---------- */

const editor = ref<EditorState | null>(null)
const editorLocale = ref('zh-CN')
const locales = ref<Array<{ code: string, nativeName: string }>>([])
const mediaPreview = ref<Record<number, string>>({})

interface EditorState {
  id: number | null
  imageMediaId: number | null
  mobileImageMediaId: number | null
  linkUrl: string
  linkTarget: 'self' | 'blank'
  enabled: boolean
  startsAt: string
  endsAt: string
  sortOrder: number
  translations: Record<string, ItemTranslation>
}

function emptyTranslation(): ItemTranslation {
  return { title: '', description: '', buttonText: '', linkUrl: '', altText: '' }
}

function currentTranslation(): ItemTranslation {
  const state = editor.value
  if (!state) return emptyTranslation()
  if (!state.translations[editorLocale.value]) {
    state.translations[editorLocale.value] = emptyTranslation()
  }
  return state.translations[editorLocale.value]!
}

function toLocalInput(iso: string | null): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function fromLocalInput(value: string): string | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

async function ensurePreview(mediaId: number | null): Promise<void> {
  if (!mediaId || mediaPreview.value[mediaId]) return
  try {
    const media = await $fetch<{ url?: string, storageKey?: string }>(`/api/admin/media/${mediaId}`)
    mediaPreview.value[mediaId] = media.url ?? (media.storageKey ? `/media/${media.storageKey}` : '')
  } catch {
    /* preview is best-effort */
  }
}

function openNewSlide(): void {
  editor.value = {
    id: null,
    imageMediaId: null,
    mobileImageMediaId: null,
    linkUrl: '',
    linkTarget: 'self',
    enabled: true,
    startsAt: '',
    endsAt: '',
    sortOrder: items.value.length,
    translations: {}
  }
}

function openEditSlide(item: AdminSliderItem): void {
  editor.value = {
    id: item.id,
    imageMediaId: item.imageMediaId,
    mobileImageMediaId: item.mobileImageMediaId,
    linkUrl: item.linkUrl ?? '',
    linkTarget: item.linkTarget,
    enabled: item.enabled,
    startsAt: toLocalInput(item.startsAt),
    endsAt: toLocalInput(item.endsAt),
    sortOrder: item.sortOrder,
    translations: JSON.parse(JSON.stringify(item.translations)) as Record<string, ItemTranslation>
  }
  void ensurePreview(item.imageMediaId)
  void ensurePreview(item.mobileImageMediaId)
}

async function saveSlide(): Promise<void> {
  const state = editor.value
  if (!state || !slider.value) return
  if (!state.imageMediaId) {
    notifyError(t('res.slider.saveFailed'), t('res.slider.imageRequired'))
    return
  }
  const payload = {
    imageMediaId: state.imageMediaId,
    mobileImageMediaId: state.mobileImageMediaId,
    linkUrl: state.linkUrl,
    linkTarget: state.linkTarget,
    enabled: state.enabled,
    startsAt: fromLocalInput(state.startsAt),
    endsAt: fromLocalInput(state.endsAt),
    sortOrder: state.sortOrder,
    translations: Object.fromEntries(
      Object.entries(state.translations).map(([code, tr]) => [code, {
        title: tr.title || null,
        description: tr.description || null,
        buttonText: tr.buttonText || null,
        linkUrl: tr.linkUrl || null,
        altText: tr.altText || null
      }])
    )
  }
  try {
    if (state.id === null) {
      await $fetch(`/api/admin/sliders/${slider.value.id}/items`, { method: 'POST', body: payload })
    } else {
      await $fetch(`/api/admin/sliders/${slider.value.id}/items/${state.id}`, { method: 'PUT', body: payload })
    }
    editor.value = null
    notify(t('res.slider.saved'))
    await loadSlider()
  } catch (e: unknown) {
    notifyError(t('res.slider.saveFailed'), (e as Error).message)
  }
}

onMounted(async () => {
  const res = await $fetch<{ locales: Array<{ code: string, nativeName: string, enabled: boolean, contentEnabled: boolean }> }>('/api/public/locales')
  locales.value = res.locales.filter(l => l.enabled && l.contentEnabled)
  if (!locales.value.some(l => l.code === editorLocale.value)) {
    editorLocale.value = locales.value[0]?.code ?? 'zh-CN'
  }
  await loadSliders()
  await loadSlider()
})

watch(selectedId, loadSlider)
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <h1 class="text-2xl font-semibold tracking-tight">
        {{ t('res.slider.label') }}
      </h1>
      <div class="flex flex-wrap items-center gap-2">
        <select
          v-model="selectedId"
          class="h-9 rounded-md border bg-background px-2 text-sm"
        >
          <option
            v-for="item in sliders"
            :key="item.id"
            :value="item.id"
          >
            {{ item.name }} ({{ item.key }})
          </option>
        </select>
        <UiButton
          :disabled="saving || !slider"
          @click="saveSettings"
        >
          {{ t('common.save') }}
        </UiButton>
        <UiButton
          variant="outline"
          :disabled="!slider"
          @click="deleteSlider"
        >
          {{ t('common.delete') }}
        </UiButton>
      </div>
    </div>

    <!-- new slider -->
    <div class="flex flex-wrap items-center gap-2 rounded-xl border p-4">
      <input
        v-model="newKey"
        :placeholder="t('res.slider.keyPlaceholder')"
        class="h-9 w-48 rounded-md border bg-background px-3 text-sm"
      >
      <input
        v-model="newName"
        :placeholder="t('res.slider.namePlaceholder')"
        class="h-9 w-56 rounded-md border bg-background px-3 text-sm"
      >
      <UiButton
        size="sm"
        :disabled="!newKey.trim()"
        @click="createSlider"
      >
        {{ t('res.slider.new') }}
      </UiButton>
    </div>

    <template v-if="slider">
      <!-- settings -->
      <UiCard class="p-5">
        <h2 class="mb-4 text-sm font-semibold tracking-wide">
          {{ t('res.slider.settings') }}
        </h2>
        <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <label class="flex items-center justify-between gap-3 text-sm">
            {{ t('res.slider.enabled') }}
            <UiSwitch
              :model-value="slider.enabled"
              @update:model-value="patchSetting({ enabled: $event as boolean })"
            />
          </label>
          <label class="flex items-center justify-between gap-3 text-sm">
            {{ t('res.slider.autoplay') }}
            <UiSwitch
              :model-value="slider.autoplay"
              @update:model-value="patchSetting({ autoplay: $event as boolean })"
            />
          </label>
          <label class="flex items-center justify-between gap-3 text-sm">
            {{ t('res.slider.pauseOnHover') }}
            <UiSwitch
              :model-value="slider.pauseOnHover"
              @update:model-value="patchSetting({ pauseOnHover: $event as boolean })"
            />
          </label>
          <label class="flex items-center justify-between gap-3 text-sm">
            {{ t('res.slider.showArrows') }}
            <UiSwitch
              :model-value="slider.showArrows"
              @update:model-value="patchSetting({ showArrows: $event as boolean })"
            />
          </label>
          <label class="flex items-center justify-between gap-3 text-sm">
            {{ t('res.slider.showIndicators') }}
            <UiSwitch
              :model-value="slider.showIndicators"
              @update:model-value="patchSetting({ showIndicators: $event as boolean })"
            />
          </label>
          <label class="flex items-center gap-2 text-sm">
            {{ t('res.slider.transition') }}
            <select
              v-model="slider.transition"
              class="h-9 flex-1 rounded-md border bg-background px-2 text-sm"
            >
              <option value="slide">
                slide
              </option>
              <option value="fade">
                fade
              </option>
            </select>
          </label>
          <label class="flex items-center gap-2 text-sm">
            {{ t('res.slider.interval') }}
            <input
              v-model.number="slider.intervalMs"
              type="number"
              min="1000"
              max="60000"
              step="500"
              class="h-9 w-28 rounded-md border bg-background px-2 text-sm"
            >
            <span class="text-xs text-muted-foreground">ms</span>
          </label>
        </div>
      </UiCard>

      <!-- slides -->
      <UiCard class="p-5">
        <div class="mb-4 flex items-center justify-between">
          <h2 class="text-sm font-semibold tracking-wide">
            {{ t('res.slider.slides') }} ({{ items.length }})
          </h2>
          <UiButton
            size="sm"
            @click="openNewSlide"
          >
            {{ t('res.slider.addSlide') }}
          </UiButton>
        </div>

        <p
          v-if="items.length === 0"
          class="py-6 text-center text-sm text-muted-foreground"
        >
          {{ t('res.slider.emptySlides') }}
        </p>

        <ul class="space-y-2">
          <li
            v-for="item in items"
            :key="item.id"
            draggable="true"
            class="flex cursor-grab items-center gap-3 rounded-lg border p-2 transition-colors hover:bg-accent/30"
            :class="dragId === item.id ? 'opacity-50' : ''"
            @dragstart="onDragStart(item)"
            @dragover="onDragOver"
            @drop="onDrop(item)"
          >
            <span
              class="cursor-grab select-none px-1 text-muted-foreground"
              aria-hidden="true"
            >☰</span>
            <img
              v-if="item.imageUrl"
              :src="item.imageUrl"
              :alt="item.translations[editorLocale]?.title || ''"
              class="h-12 w-[110px] shrink-0 rounded border object-cover"
            >
            <div
              v-else
              class="h-12 w-[110px] shrink-0 rounded border bg-muted"
            />
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-medium">
                {{ item.translations[editorLocale]?.title || item.translations[Object.keys(item.translations)[0] ?? '']?.title || `#${item.id}` }}
              </p>
              <p class="truncate text-xs text-muted-foreground">
                {{ item.linkUrl || t('res.slider.noLink') }}
              </p>
            </div>
            <span
              class="shrink-0 text-xs font-medium"
              :class="statusStyles[statusOf(item)]"
            >
              {{ t(`res.slider.status.${statusOf(item)}`) }}
            </span>
            <div class="flex shrink-0 items-center gap-1">
              <button
                type="button"
                class="h-7 w-7 rounded border text-xs hover:bg-accent"
                :aria-label="t('res.slider.moveUp')"
                @click="moveItem(item, -1)"
              >
                ↑
              </button>
              <button
                type="button"
                class="h-7 w-7 rounded border text-xs hover:bg-accent"
                :aria-label="t('res.slider.moveDown')"
                @click="moveItem(item, 1)"
              >
                ↓
              </button>
              <button
                type="button"
                class="h-7 rounded border px-2 text-xs hover:bg-accent"
                @click="openEditSlide(item)"
              >
                {{ t('common.edit') }}
              </button>
              <button
                type="button"
                class="h-7 rounded border border-destructive/40 px-2 text-xs text-destructive hover:bg-destructive/10"
                @click="deleteItem(item)"
              >
                {{ t('common.delete') }}
              </button>
            </div>
          </li>
        </ul>
      </UiCard>
    </template>

    <!-- slide editor dialog -->
    <div
      v-if="editor"
      class="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4"
      @click.self="editor = null"
    >
      <div class="w-full max-w-2xl space-y-4 rounded-xl border bg-background p-5">
        <div class="flex items-center justify-between">
          <h2 class="text-lg font-semibold">
            {{ editor.id === null ? t('res.slider.addSlide') : t('res.slider.editSlide') }}
          </h2>
          <select
            v-model="editorLocale"
            class="h-8 rounded-md border bg-background px-2 text-xs"
          >
            <option
              v-for="locale in locales"
              :key="locale.code"
              :value="locale.code"
            >
              {{ locale.nativeName }} ({{ locale.code }})
            </option>
          </select>
        </div>

        <div class="space-y-3">
          <div>
            <p class="mb-1 text-xs font-medium text-muted-foreground">
              {{ t('res.slider.desktopImage') }}
            </p>
            <MediaPickerField
              :key="`desktop-${editor.id ?? 'new'}`"
              :model-value="editor.imageMediaId"
              usage="slider"
              recommended="1600×700 · 16:7"
              @update:model-value="editor.imageMediaId = $event; ensurePreview(editor.imageMediaId)"
            />
            <div
              v-if="editor.imageMediaId && mediaPreview[editor.imageMediaId]"
              class="mt-2"
            >
              <img
                :src="mediaPreview[editor.imageMediaId]"
                :alt="t('res.slider.desktopImage')"
                class="aspect-[3/1] w-full rounded-md border object-cover"
              >
              <p class="mt-1 text-center text-[10px] text-muted-foreground">
                16 : 7
              </p>
            </div>
            <p class="mt-1 text-[10px] text-muted-foreground">
              {{ t('res.slider.desktopHint') }}
            </p>
          </div>

          <div>
            <p class="mb-1 text-xs font-medium text-muted-foreground">
              {{ t('res.slider.mobileImage') }}
            </p>
            <MediaPickerField
              :key="`mobile-${editor.id ?? 'new'}`"
              :model-value="editor.mobileImageMediaId"
              usage="slider"
              recommended="900×675 · 4:3"
              @update:model-value="editor.mobileImageMediaId = $event; ensurePreview(editor.mobileImageMediaId)"
            />
            <div
              v-if="editor.mobileImageMediaId && mediaPreview[editor.mobileImageMediaId]"
              class="mt-2 w-48"
            >
              <img
                :src="mediaPreview[editor.mobileImageMediaId]"
                :alt="t('res.slider.mobileImage')"
                class="aspect-[4/3] w-full rounded-md border object-cover"
              >
              <p class="mt-1 text-center text-[10px] text-muted-foreground">
                4 : 3
              </p>
            </div>
            <p class="mt-1 text-[10px] text-muted-foreground">
              {{ t('res.slider.mobileHint') }}
            </p>
          </div>
        </div>

        <div class="grid gap-3 sm:grid-cols-2">
          <label class="space-y-1 text-sm">
            <span class="text-muted-foreground">{{ t('res.slider.linkUrl') }}</span>
            <input
              v-model="editor.linkUrl"
              class="h-9 w-full rounded-md border bg-background px-3 text-sm"
              placeholder="/posts/... or https://..."
            >
          </label>
          <label class="space-y-1 text-sm">
            <span class="text-muted-foreground">{{ t('res.slider.openIn') }}</span>
            <select
              v-model="editor.linkTarget"
              class="h-9 w-full rounded-md border bg-background px-2 text-sm"
            >
              <option value="self">
                {{ t('res.slider.targetSelf') }}
              </option>
              <option value="blank">
                {{ t('res.slider.targetBlank') }}
              </option>
            </select>
          </label>
          <label class="space-y-1 text-sm">
            <span class="text-muted-foreground">{{ t('res.slider.startAt') }}</span>
            <input
              v-model="editor.startsAt"
              type="datetime-local"
              class="h-9 w-full rounded-md border bg-background px-3 text-sm"
            >
          </label>
          <label class="space-y-1 text-sm">
            <span class="text-muted-foreground">{{ t('res.slider.endAt') }}</span>
            <input
              v-model="editor.endsAt"
              type="datetime-local"
              class="h-9 w-full rounded-md border bg-background px-3 text-sm"
            >
          </label>
        </div>

        <div class="space-y-3 rounded-lg border p-3">
          <p class="text-xs font-medium text-muted-foreground">
            {{ t('res.slider.copy') }} ({{ editorLocale }})
          </p>
          <input
            v-model="currentTranslation().title"
            :placeholder="t('res.slider.slideTitle')"
            maxlength="80"
            class="h-9 w-full rounded-md border bg-background px-3 text-sm"
          >
          <textarea
            v-model="currentTranslation().description"
            :placeholder="t('res.slider.slideDescription')"
            maxlength="160"
            rows="2"
            class="w-full rounded-md border bg-background px-3 py-2 text-sm"
          />
          <div class="grid gap-3 sm:grid-cols-2">
            <input
              v-model="currentTranslation().buttonText"
              :placeholder="t('res.slider.slideButton')"
              maxlength="30"
              class="h-9 w-full rounded-md border bg-background px-3 text-sm"
            >
            <input
              v-model="currentTranslation().altText"
              :placeholder="t('res.slider.slideAlt')"
              maxlength="300"
              class="h-9 w-full rounded-md border bg-background px-3 text-sm"
            >
          </div>
        </div>

        <label class="flex items-center justify-between gap-3 text-sm">
          {{ t('res.slider.slideEnabled') }}
          <UiSwitch
            :model-value="editor.enabled"
            @update:model-value="editor.enabled = $event as boolean"
          />
        </label>

        <div class="flex justify-end gap-2">
          <UiButton
            variant="outline"
            @click="editor = null"
          >
            {{ t('common.cancel') }}
          </UiButton>
          <UiButton @click="saveSlide">
            {{ t('common.save') }}
          </UiButton>
        </div>
      </div>
    </div>
  </div>
</template>
