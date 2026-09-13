<script setup lang="ts">
import { useI18n } from '~/admin/i18n'
import { notify, notifyError } from '~/admin/notifications/notify'
import { SearchIcon } from 'lucide-vue-next'
import SettingsFieldRenderer, { type FieldMeta } from './ui/SettingsFieldRenderer.vue'
import SettingsSaveBar from './ui/SettingsSaveBar.vue'

/* P34 Settings Workspace (docs/设置.txt S1+S2, §5/6/7/15/55/63/65):
   schema-driven pages at /admin/settings/:page, left nav generated from
   the registry, search with scroll+highlight, dirty save bar with an
   unsaved-changes route guard. No raw keys, no raw JSON. */

const props = defineProps<{ resource: { name: string }, id?: string }>()

const { t, locale } = useI18n()
const allow = useCan()
const canEdit = computed(() => allow('settings.edit'))

interface Bilingual { zh: string, en: string }
interface NavPage {
  id: string
  group: string
  groupLabel: Bilingual
  title: Bilingual
  description: Bilingual
  icon: string
  module: string | null
}
interface SearchItem {
  pageId: string
  pageTitle: Bilingual
  key: string
  label: Bilingual
  description?: Bilingual
}
interface Section {
  id: string
  title: Bilingual
  description?: Bilingual
  fields: FieldMeta[]
}
interface PageData {
  page: { id: string, group: string, title: Bilingual, description: Bilingual, icon: string }
  sections: Section[]
}

function label(value: Bilingual | undefined): string {
  if (!value) return ''
  return locale.value === 'en' ? value.en : value.zh
}

const nav = ref<NavPage[]>([])
const searchIndex = ref<SearchItem[]>([])
const pageId = computed(() => props.id ?? nav.value[0]?.id ?? '')
const page = ref<PageData | null>(null)
const loading = ref(true)
const loadError = ref('')
const saving = ref(false)
const dirty = ref(false)
const highlightKey = ref('')

const navGroups = computed(() => {
  const groups: Array<{ id: string, label: Bilingual, pages: NavPage[] }> = []
  for (const item of nav.value) {
    let group = groups.find(g => g.id === item.group)
    if (!group) {
      group = { id: item.group, label: item.groupLabel, pages: [] }
      groups.push(group)
    }
    group.pages.push(item)
  }
  return groups
})

/* form state: key → value */
const form = ref<Record<string, string | number | boolean | null>>({})
/* secrets: replace-only queue (§44) */
const secretReplacements = ref<Record<string, string>>({})
const serverSnapshot = ref<Record<string, string | number | boolean | null>>({})

function isFieldVisible(field: FieldMeta): boolean {
  if (!field.visibleWhen) return true
  return form.value[field.visibleWhen.key] === field.visibleWhen.equals
}

function snapshotForm(data: PageData): Record<string, string | number | boolean | null> {
  const snap: Record<string, string | number | boolean | null> = {}
  for (const section of data.sections) {
    for (const field of section.fields) {
      snap[field.key] = field.value ?? null
    }
  }
  return snap
}

watch(form, () => {
  dirty.value = JSON.stringify(form.value) !== JSON.stringify(serverSnapshot.value)
    || Object.keys(secretReplacements.value).length > 0
}, { deep: true })

async function loadNav(): Promise<void> {
  loadError.value = ''
  const res = await $fetch<{ pages: NavPage[], searchIndex: SearchItem[] }>('/api/admin/settings-ui')
  /* §53/76: pages bound to a disabled module disappear from nav AND search */
  const visible = (p: NavPage) => !p.module || allow(`${p.module}.view`)
  nav.value = (res.pages ?? []).filter(visible)
  const moduleByPage = new Map((res.pages ?? []).map(p => [p.id, p.module]))
  searchIndex.value = (res.searchIndex ?? []).filter((s) => {
    const module = moduleByPage.get(s.pageId) ?? null
    return !module || allow(`${module}.view`)
  })
}

async function loadPage(id: string): Promise<void> {
  if (!id) return
  loading.value = true
  try {
    const data = await $fetch<PageData>(`/api/admin/settings-ui/${id}`)
    page.value = data
    serverSnapshot.value = snapshotForm(data)
    form.value = { ...serverSnapshot.value }
    secretReplacements.value = {}
    dirty.value = false
  } catch (e: unknown) {
    const err = e as Error & { statusCode?: number }
    if (err.statusCode === 404 && nav.value[0]) {
      await navigateTo(`/admin/settings/${nav.value[0].id}`, { replace: true })
      return
    }
    notifyError(t('settings.ui.loadFailed'), (e as Error).message)
    loadError.value = (e as Error).message || t('settings.ui.loadFailed')
  } finally {
    loading.value = false
  }
}

watch(pageId, (id) => {
  if (id) void loadPage(id)
})

onMounted(async () => {
  try {
    await loadNav()
    const target = pageId.value
    if (target && !props.id) {
      await navigateTo(`/admin/settings/${target}`, { replace: true })
    } else if (target) {
      await loadPage(target)
    }
  } catch (e: unknown) {
    loadError.value = (e as Error).message || t('settings.ui.loadFailed')
  } finally {
    loading.value = false
  }
})

async function retryLoad(): Promise<void> {
  loading.value = true
  loadError.value = ''
  try {
    await loadNav()
    if (pageId.value) await loadPage(pageId.value)
  } catch (e: unknown) {
    loadError.value = (e as Error).message || t('settings.ui.loadFailed')
  } finally {
    loading.value = false
  }
}

async function save(): Promise<void> {
  if (!page.value) return
  saving.value = true
  try {
    const values: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(form.value)) {
      if (JSON.stringify(value) !== JSON.stringify(serverSnapshot.value[key])) {
        values[key] = value
      }
    }
    for (const [key, value] of Object.entries(secretReplacements.value)) {
      values[key] = value
    }
    if (Object.keys(values).length > 0) {
      await $fetch(`/api/admin/settings-ui/${page.value.page.id}`, { method: 'PATCH', body: { values } })
      notify(t('res.settingsui.saved'))
    }
    await loadPage(page.value.page.id)
  } catch (e) {
    notifyError(t('res.settingsui.saveFailed'), (e as Error).message)
  } finally {
    saving.value = false
  }
}

function discard(): void {
  form.value = { ...serverSnapshot.value }
  secretReplacements.value = {}
  dirty.value = false
}

async function resetField(key: string): Promise<void> {
  if (!page.value) return
  try {
    await $fetch(`/api/admin/settings-ui/${page.value.page.id}/reset`, { method: 'POST', body: { keys: [key] } })
    await loadPage(page.value.page.id)
    notify(t('res.settingsui.resetDone'))
  } catch (e) {
    notifyError(t('res.settingsui.saveFailed'), (e as Error).message)
  }
}

/* §7: unsaved-changes route guard */
onBeforeRouteLeave(() => {
  if (dirty.value && !window.confirm(t('res.settingsui.unsavedConfirm'))) {
    return false
  }
  return true
})

function onBeforeUnload(e: BeforeUnloadEvent): void {
  if (dirty.value) e.preventDefault()
}
onMounted(() => window.addEventListener('beforeunload', onBeforeUnload))
onUnmounted(() => window.removeEventListener('beforeunload', onBeforeUnload))

/* §15/16 search: filter the index, jump to page, scroll + highlight */
const search = ref('')
const searchResults = computed(() => {
  const term = search.value.trim().toLowerCase()
  if (term.length < 2) return []
  return searchIndex.value.filter(item =>
    label(item.label).toLowerCase().includes(term)
    || (item.description && label(item.description).toLowerCase().includes(term))
    || item.key.toLowerCase().includes(term)
  ).slice(0, 8)
})

async function jumpTo(item: SearchItem): Promise<void> {
  search.value = ''
  if (item.pageId !== pageId.value) {
    await navigateTo(`/admin/settings/${item.pageId}`)
  }
  await nextTick()
  highlightKey.value = item.key
  await nextTick()
  document.getElementById(`setting-${item.key}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  setTimeout(() => {
    highlightKey.value = ''
  }, 2000)
}
</script>

<template>
  <div class="mx-auto max-w-[1280px]">
    <!-- header (§6): title + description + search only -->
    <div class="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight">
          {{ t('res.settings.label') }}
        </h1>
        <p class="mt-0.5 text-sm text-muted-foreground">
          {{ t('settings.ui.subtitle') }}
        </p>
      </div>
      <div class="relative w-full max-w-xs">
        <SearchIcon class="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          v-model="search"
          type="search"
          :placeholder="t('settings.ui.search')"
          class="h-9 w-full rounded-md border bg-background pl-8 pr-3 text-sm outline-none focus:ring-1 focus:ring-primary"
        >
        <div
          v-if="searchResults.length > 0"
          class="absolute z-20 mt-1 w-full overflow-hidden rounded-md border bg-card shadow-lg"
        >
          <button
            v-for="item in searchResults"
            :key="item.key"
            type="button"
            class="block w-full px-3 py-2 text-left text-sm hover:bg-accent"
            @click="jumpTo(item)"
          >
            <span class="block truncate">{{ label(item.label) }}</span>
            <span class="block truncate text-xs text-muted-foreground">{{ label(item.pageTitle) }} · {{ item.key }}</span>
          </button>
        </div>
      </div>
    </div>

    <div class="grid gap-8 lg:grid-cols-[240px,minmax(0,1fr)]">
      <!-- left navigation (§5/9): generated from the registry -->
      <nav class="max-lg:hidden">
        <div
          v-for="group in navGroups"
          :key="group.id"
          class="mb-4"
        >
          <p class="mb-1 px-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            {{ label(group.label) }}
          </p>
          <NuxtLink
            v-for="item in group.pages"
            :key="item.id"
            :to="`/admin/settings/${item.id}`"
            class="block rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent"
            :class="item.id === pageId ? 'bg-accent font-medium' : 'text-muted-foreground'"
          >
            {{ label(item.title) }}
          </NuxtLink>
        </div>
      </nav>

      <!-- page content (§65: sections + separators, not giant cards) -->
      <div class="min-w-0 space-y-8">
        <div
          v-if="loading && !page"
          class="text-sm text-muted-foreground"
        >
          {{ t('common.status.loading') }}
        </div>

        <div
          v-else-if="loadError && !page"
          class="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm"
        >
          <p class="font-medium text-destructive">
            {{ t('settings.ui.loadFailed') }}
          </p>
          <p class="mt-1 text-muted-foreground">
            {{ loadError }}
          </p>
          <UiButton
            class="mt-3"
            size="sm"
            variant="outline"
            @click="retryLoad"
          >
            {{ t('common.retry') }}
          </UiButton>
        </div>

        <template
          v-for="(section, si) in page?.sections ?? []"
          :key="section.id"
        >
          <div
            v-if="si > 0"
            class="border-t"
          />
          <section class="space-y-4">
            <div>
              <h2 class="text-sm font-semibold">
                {{ label(section.title) }}
              </h2>
              <p
                v-if="section.description"
                class="mt-0.5 text-xs text-muted-foreground"
              >
                {{ label(section.description) }}
              </p>
            </div>
            <div
              v-for="field in section.fields"
              v-show="isFieldVisible(field)"
              :id="`setting-${field.key}`"
              :key="field.key"
              class="rounded-lg p-1 transition-colors"
              :class="highlightKey === field.key ? 'bg-primary/10 ring-1 ring-primary/40' : ''"
            >
              <div class="flex items-start justify-between gap-4">
                <SettingsFieldRenderer
                  :field="field"
                  :model-value="form[field.key] ?? null"
                  :disabled="!canEdit"
                  @update:model-value="form[field.key] = $event"
                  @replace="secretReplacements[field.key] = $event"
                />
                <button
                  v-if="canEdit && field.source === 'database' && field.type !== 'secret'"
                  type="button"
                  class="mt-5 shrink-0 text-xs text-muted-foreground hover:text-foreground"
                  :title="t('res.settingsui.resetField')"
                  @click="resetField(field.key)"
                >
                  {{ t('res.settingsui.resetField') }}
                </button>
              </div>
            </div>
          </section>
        </template>

        <!-- §7 dirty save bar -->
        <SettingsSaveBar
          v-if="dirty"
          :saving="saving"
          @save="save"
          @discard="discard"
        />
      </div>
    </div>
  </div>
</template>
