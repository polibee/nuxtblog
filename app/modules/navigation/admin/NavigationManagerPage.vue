<script setup lang="ts">
import NavigationItemPicker from './NavigationItemPicker.vue'
import NavigationTree from './NavigationTree.vue'
import type { EditorItem } from './NavigationTreeItem.vue'
import type { NavigationTreeInput } from '#shared/schemas/navigation'
import { resolveAdminDisplayLabel } from '~/admin/i18n/display-label'

/* WordPress-style navigation manager (spec §4). Location + locale
   selects load the matching variant; all edits are local until the
   save button writes the tree transactionally. */

defineProps<{ resource: { name: string } }>()

const { t } = useI18n()

interface VariantMeta {
  id: number
  localeId: number
  status: string
  isDefault: boolean
}

interface NavigationInfo {
  id: number
  key: string
  location: string
  adminName: string
  enabled: boolean
  variants: VariantMeta[]
}

interface LocaleOption {
  code: string
  nativeName: string
}

const navigations = ref<NavigationInfo[]>([])
const locales = ref<LocaleOption[]>([])
const selectedLocation = ref('header')
const selectedLocale = ref('')
const variant = ref<VariantMeta | null>(null)
const tree = ref<EditorItem[]>([])
const draggedUid = ref<string | null>(null)
const status = ref<'clean' | 'dirty' | 'saving' | 'saved' | 'error'>('clean')
const loading = ref(false)
const noVariant = ref(false)

const maxDepth = 3
let uidSeq = 0

const selectedNavigation = computed(() =>
  navigations.value.find(n => n.location === selectedLocation.value)
)
function uid(): string {
  uidSeq += 1
  return `e${Date.now()}-${uidSeq}`
}

async function loadLocations(): Promise<void> {
  const res = await $fetch<{ items: NavigationInfo[] }>('/api/admin/navigations')
  navigations.value = res.items
  if (!navigations.value.some(n => n.location === selectedLocation.value)) {
    selectedLocation.value = navigations.value[0]?.location ?? 'header'
  }
}

async function loadLocales(): Promise<void> {
  const res = await $fetch<{ locales: Array<{ code: string, nativeName: string, enabled: boolean, contentEnabled: boolean }> }>(
    '/api/public/locales'
  )
  locales.value = res.locales.filter(l => l.enabled && l.contentEnabled)
  if (!locales.value.some(l => l.code === selectedLocale.value)) {
    selectedLocale.value = locales.value[0]?.code ?? 'zh-CN'
  }
}

async function loadVariant(): Promise<void> {
  const navigation = selectedNavigation.value
  if (!navigation || !selectedLocale.value) return
  loading.value = true
  status.value = 'clean'
  noVariant.value = false
  try {
    const res = await $fetch<{ variant: VariantMeta, items: Array<Record<string, unknown>> }>(
      `/api/admin/navigations/${navigation.id}/variants/${selectedLocale.value}`
    )
    variant.value = res.variant
    tree.value = buildEditorItems(res.items)
  } catch {
    variant.value = null
    tree.value = []
    noVariant.value = true
  } finally {
    loading.value = false
  }
}

function buildEditorItems(flat: Array<Record<string, unknown>>): EditorItem[] {
  const idToItem = new Map<number, EditorItem>()
  for (const row of flat) {
    idToItem.set(Number(row.id), {
      uid: uid(),
      label: String(row.label ?? ''),
      type: String(row.type ?? 'custom') as EditorItem['type'],
      targetEntityType: (row.targetEntityType ?? undefined) as EditorItem['targetEntityType'],
      targetEntityId: (row.targetEntityId ?? undefined) as number | undefined,
      targetSummary: row.targetEntityType ? `${row.targetEntityType} #${row.targetEntityId}` : String(row.customUrl ?? ''),
      customUrl: (row.customUrl ?? undefined) as string | undefined,
      titleAttribute: (row.titleAttribute ?? undefined) as string | undefined,
      openInNewTab: Boolean(row.openInNewTab),
      rel: (row.rel ?? undefined) as string | undefined,
      nofollow: Boolean(row.nofollow),
      enabled: Boolean(row.enabled),
      children: []
    })
  }
  const roots: EditorItem[] = []
  for (const row of flat) {
    const item = idToItem.get(Number(row.id))!
    const parent = row.parentId ? idToItem.get(Number(row.parentId)) : undefined
    if (parent) parent.children.push(item)
    else roots.push(item)
  }
  return roots
}

async function createVariant(copyFrom: number | null): Promise<void> {
  const navigation = selectedNavigation.value
  if (!navigation) return
  try {
    await $fetch(`/api/admin/navigations/${navigation.id}/variants`, {
      method: 'POST',
      body: {
        localeCode: selectedLocale.value,
        copyFromVariantId: copyFrom
      }
    })
    await loadVariant()
  } catch (e: unknown) {
    notifyError(t('res.navigation.saveFailed'), (e as Error).message)
  }
}

async function save(): Promise<void> {
  const navigation = selectedNavigation.value
  if (!navigation || !variant.value) return
  status.value = 'saving'
  try {
    const payload: NavigationTreeInput = { items: toPayload(tree.value) }
    await $fetch(`/api/admin/navigation-variants/${variant.value.id}/tree`, {
      method: 'PUT',
      body: payload
    })
    status.value = 'saved'
    if (import.meta.client) localStorage.setItem('public-navigation-updated', String(Date.now()))
    notify(t('res.navigation.saved'))
  } catch (e: unknown) {
    status.value = 'error'
    notifyError(t('res.navigation.saveFailed'), (e as Error).message)
  }
}

function toPayload(items: EditorItem[]): NavigationTreeInput['items'] {
  return items.map(item => ({
    label: item.label,
    type: item.type,
    targetEntityType: item.type === 'custom' || item.type === 'group' ? undefined : item.targetEntityType,
    targetEntityId: item.type === 'custom' || item.type === 'group' ? undefined : item.targetEntityId,
    customUrl: item.type === 'custom' ? item.customUrl : undefined,
    titleAttribute: item.titleAttribute || undefined,
    openInNewTab: item.openInNewTab || undefined,
    rel: item.rel || undefined,
    nofollow: item.nofollow || undefined,
    enabled: item.enabled,
    sortOrder: undefined,
    children: item.children.length > 0 ? toPayload(item.children) : undefined
  })) as NavigationTreeInput['items']
}

function markDirty(): void {
  if (status.value !== 'saving') status.value = 'dirty'
}

/* picker: append items at the bottom of the root level */
function addItems(items: EditorItem[]): void {
  tree.value.push(...items)
  markDirty()
}

function addFooterColumn(): void {
  tree.value.push({
    uid: uid(),
    label: t('res.navigation.footer.newColumn'),
    type: 'group',
    enabled: true,
    editing: true,
    children: []
  })
  markDirty()
}

/* tree mutation: move dragged before/after target or into it */
function onDrop(payload: { draggedUid: string, targetUid: string, position: 'before' | 'after' | 'child' }): void {
  const dragged = detach(payload.draggedUid)
  if (!dragged) return
  const targetParent = findParentList(tree.value, payload.targetUid)
  if (!targetParent) {
    tree.value.push(dragged)
    markDirty()
    return
  }
  const index = targetParent.findIndex(i => i.uid === payload.targetUid)
  if (payload.position === 'child') {
    const target = targetParent.find(i => i.uid === payload.targetUid)
    if (target && depthOf(target) + depthOf(dragged) <= maxDepth) {
      target.children.push(dragged)
      target.expanded = true
    } else {
      tree.value.push(dragged)
    }
    markDirty()
    return
  }
  const insertAt = payload.position === 'before' ? index : index + 1
  targetParent.splice(insertAt, 0, dragged)
  markDirty()
}

function detach(uid: string, list: EditorItem[] = tree.value): EditorItem | null {
  const index = list.findIndex(i => i.uid === uid)
  if (index >= 0) return list.splice(index, 1)[0] ?? null
  for (const item of list) {
    const found = detach(uid, item.children)
    if (found) return found
  }
  return null
}

function findParentList(list: EditorItem[], uid: string): EditorItem[] | null {
  if (list.some(i => i.uid === uid)) return list
  for (const item of list) {
    const nested = findParentList(item.children, uid)
    if (nested) return nested
  }
  return null
}

function depthOf(item: EditorItem): number {
  return item.children.length === 0 ? 1 : 1 + Math.max(...item.children.map(depthOf))
}

/* keyboard alternative to drag & drop (spec §4.7) */
function onKeyboardMove(payload: { uid: string, direction: 'up' | 'down' | 'out' }): void {
  const parent = findParentList(tree.value, payload.uid)
  if (!parent) return
  const index = parent.findIndex(i => i.uid === payload.uid)
  if (payload.direction === 'up' && index > 0) {
    const [item] = parent.splice(index, 1)
    parent.splice(index - 1, 0, item!)
    markDirty()
    return
  }
  if (payload.direction === 'down' && index < parent.length - 1) {
    const [item] = parent.splice(index, 1)
    parent.splice(index + 1, 0, item!)
    markDirty()
    return
  }
  if (payload.direction === 'out') {
    const item = detach(payload.uid)
    const rootList = tree.value
    if (item) {
      rootList.push(item)
      markDirty()
    }
  }
}

function removeItem(uid: string): void {
  detach(uid)
  markDirty()
}

onMounted(async () => {
  await Promise.all([loadLocations(), loadLocales()])
  await loadVariant()
})

watch([selectedLocation, selectedLocale], loadVariant)
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <h1 class="text-2xl font-semibold tracking-tight">
        {{ t('res.navigation.managerTitle') }}
      </h1>
      <div class="flex items-center gap-2">
        <select
          v-model="selectedLocation"
          class="h-9 rounded-md border bg-background px-2 text-sm"
        >
          <option
            v-for="navigation in navigations"
            :key="navigation.id"
            :value="navigation.location"
          >
            {{ navigation.adminName }} ({{ navigation.location }})
          </option>
        </select>
        <select
          v-model="selectedLocale"
          class="h-9 rounded-md border bg-background px-2 text-sm"
        >
          <option
            v-for="locale in locales"
            :key="locale.code"
            :value="locale.code"
          >
            {{ locale.nativeName }} ({{ locale.code }})
          </option>
        </select>
        <UiButton
          :disabled="status === 'saving' || !variant"
          @click="save"
        >
          {{ status === 'saving' ? t('common.saving') : t('res.navigation.saveMenu') }}
        </UiButton>
        <span
          class="text-xs"
          :class="{
            'text-muted-foreground': status === 'clean',
            'text-warning': status === 'dirty',
            'text-[var(--success)]': status === 'saved',
            'text-destructive': status === 'error'
          }"
        >
          {{ resolveAdminDisplayLabel(t, 'navigationStatus', status) }}
        </span>
      </div>
    </div>

    <div
      v-if="noVariant"
      class="space-y-3 rounded-xl border p-6 text-center"
    >
      <p class="text-sm text-muted-foreground">
        {{ t('res.navigation.noVariant', { locale: selectedLocale }) }}
      </p>
      <div class="flex justify-center gap-2">
        <UiButton
          size="sm"
          @click="createVariant(null)"
        >
          {{ t('res.navigation.createEmpty') }}
        </UiButton>
        <UiButton
          v-if="selectedNavigation?.variants.length"
          size="sm"
          variant="outline"
          @click="createVariant(selectedNavigation.variants[0]!.id)"
        >
          {{ t('res.navigation.copyFromDefault') }}
        </UiButton>
      </div>
    </div>

    <div
      v-else
      class="grid gap-6 lg:grid-cols-[320px_1fr]"
    >
      <UiCard class="p-4">
        <h2 class="mb-3 text-sm font-semibold">
          {{ t('res.navigation.picker.title') }}
        </h2>
        <NavigationItemPicker
          :menu-locale="selectedLocale"
          @add="addItems"
        />
      </UiCard>

      <UiCard class="p-4">
        <div class="mb-3 flex items-center justify-between gap-2">
          <h2 class="text-sm font-semibold">
            {{ t('res.navigation.tree.title') }}
          </h2>
          <UiButton
            v-if="selectedLocation === 'footer'"
            size="sm"
            variant="outline"
            @click="addFooterColumn"
          >
            {{ t('res.navigation.footer.addColumn') }}
          </UiButton>
        </div>
        <NavigationTree
          :items="tree"
          :dragged-uid="draggedUid"
          :max-depth="maxDepth"
          @drag-start="draggedUid = $event"
          @drop="onDrop"
          @keyboard-move="onKeyboardMove"
          @remove="removeItem"
        />
        <p class="mt-3 text-xs text-muted-foreground">
          {{ t('res.navigation.tree.hint', { depth: maxDepth }) }}
        </p>
      </UiCard>
    </div>
  </div>
</template>
