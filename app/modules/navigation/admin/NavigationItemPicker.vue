<script setup lang="ts">
import { PlusIcon } from 'lucide-vue-next'
import type { EditorItem } from './NavigationTreeItem.vue'

/* Left panel: pick existing pages/categories/posts or define a custom
   link, then emit them for the menu tree (spec §4.5). */

const props = defineProps<{
  menuLocale: string
}>()

const emit = defineEmits<{
  add: [items: EditorItem[]]
}>()

const { t } = useI18n()
const activeTab = ref<'pages' | 'custom' | 'categories' | 'posts'>('pages')
const search = ref('')

interface PickOption {
  id: number
  label: string
}

const pages = ref<PickOption[]>([])
const categories = ref<PickOption[]>([])
const posts = ref<PickOption[]>([])
const checked = ref<number[]>([])

const customUrl = ref('')
const customLabel = ref('')

async function loadOptions(): Promise<void> {
  try {
    const [pageRes, catRes, postRes] = await Promise.all([
      $fetch<{ items: Array<{ id: number, title: string }> }>('/api/admin/pages', {
        query: { perPage: 200 }
      }),
      $fetch<{ items: Array<{ id: number, title: string }> }>('/api/admin/categories', {
        query: { perPage: 200 }
      }),
      $fetch<{ items: Array<{ id: number, title: string }> }>('/api/admin/posts', {
        query: { perPage: 200, status: 'published' }
      })
    ])
    pages.value = pageRes.items.map(p => ({ id: p.id, label: p.title }))
    categories.value = catRes.items.map(c => ({ id: c.id, label: c.title }))
    posts.value = postRes.items.map(p => ({ id: p.id, label: p.title }))
  } catch {
    // picker stays empty on failure
  }
}

/* auto-discovery (user request): new pages/categories/posts must show up
   without reopening the menu editor — reload on tab switch, on content
   save events, and when the window regains focus */
let lastFocusLoad = 0
function onFocusReload(): void {
  const now = Date.now()
  if (now - lastFocusLoad < 5000) return
  lastFocusLoad = now
  void loadOptions()
}

onMounted(() => {
  void loadOptions()
  window.addEventListener('focus', onFocusReload)
  onAdminEvent('posts:refresh', () => void loadOptions())
})
onUnmounted(() => {
  window.removeEventListener('focus', onFocusReload)
})
watch(activeTab, () => void loadOptions())
watch(() => props.menuLocale, loadOptions)

const filtered = computed<PickOption[]>(() => {
  const source = activeTab.value === 'pages'
    ? pages.value
    : activeTab.value === 'categories'
      ? categories.value
      : activeTab.value === 'posts'
        ? posts.value
        : []
  const term = search.value.trim().toLowerCase()
  return term ? source.filter(o => o.label.toLowerCase().includes(term)) : source
})

function uid(): string {
  return `n${Date.now()}${Math.floor(Math.random() * 1000)}`
}

function addChecked(): void {
  const type = activeTab.value === 'pages' ? 'page' : activeTab.value === 'categories' ? 'category' : 'post'
  const source = activeTab.value === 'pages' ? pages.value : activeTab.value === 'categories' ? categories.value : posts.value
  const items = checked.value
    .map(id => source.find(o => o.id === id))
    .filter((o): o is PickOption => o !== undefined)
    .map(option => ({
      uid: uid(),
      label: option.label,
      type: type as EditorItem['type'],
      targetEntityType: type as 'page' | 'post' | 'category',
      targetEntityId: option.id,
      targetSummary: option.label,
      enabled: true,
      children: []
    }))
  if (items.length > 0) emit('add', items)
  checked.value = []
}

function addCustom(): void {
  if (!customLabel.value.trim()) return
  emit('add', [{
    uid: uid(),
    label: customLabel.value.trim(),
    type: 'custom',
    customUrl: customUrl.value.trim() || '/',
    enabled: true,
    children: []
  }])
  customUrl.value = ''
  customLabel.value = ''
}
</script>

<template>
  <div class="space-y-3">
    <UiTabs
      v-model="activeTab"
      :tabs="[
        { value: 'pages', label: t('res.navigation.picker.pages') },
        { value: 'custom', label: t('res.navigation.picker.custom') },
        { value: 'categories', label: t('res.navigation.picker.categories') },
        { value: 'posts', label: t('res.navigation.picker.posts') }
      ]"
    />

    <template v-if="activeTab === 'custom'">
      <div class="space-y-2">
        <input
          v-model="customUrl"
          :placeholder="t('res.navigation.field.url')"
          class="h-9 w-full rounded-md border bg-background px-3 text-sm"
        >
        <input
          v-model="customLabel"
          :placeholder="t('res.menus.field.label')"
          class="h-9 w-full rounded-md border bg-background px-3 text-sm"
        >
        <UiButton
          class="w-full"
          size="sm"
          @click="addCustom"
        >
          <PlusIcon class="h-4 w-4" /> {{ t('res.navigation.addToMenu') }}
        </UiButton>
      </div>
    </template>

    <template v-else>
      <input
        v-model="search"
        :placeholder="t('common.search')"
        class="h-9 w-full rounded-md border bg-background px-3 text-sm"
      >
      <div class="max-h-56 space-y-1 overflow-y-auto rounded-md border p-2">
        <label
          v-for="option in filtered"
          :key="option.id"
          class="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 text-sm hover:bg-accent/50"
        >
          <input
            v-model="checked"
            :value="option.id"
            type="checkbox"
          >
          {{ option.label }}
        </label>
        <p
          v-if="filtered.length === 0"
          class="px-1 text-xs text-muted-foreground"
        >
          {{ t('res.navigation.picker.none') }}
        </p>
      </div>
      <UiButton
        class="w-full"
        size="sm"
        :disabled="checked.length === 0"
        @click="addChecked"
      >
        <PlusIcon class="h-4 w-4" /> {{ t('res.navigation.addToMenu') }}
      </UiButton>
    </template>
  </div>
</template>
