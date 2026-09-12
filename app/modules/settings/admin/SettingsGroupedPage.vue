<script setup lang="ts">
import { DialogContent, DialogOverlay, DialogPortal, DialogRoot, DialogTitle } from 'reka-ui'
import type { Paginated } from '#shared/types/api'
import SettingsGroupForm, { type SettingItem } from './SettingsGroupForm.vue'
import EmailSettingsPanel from './EmailSettingsPanel.vue'
import DatabaseSettingsPanel from './DatabaseSettingsPanel.vue'

defineProps<{ resource: { name: string } }>()

const allow = useCan()
const canEdit = computed(() => allow('settings.edit'))

const settings = ref<SettingItem[]>([])
const loading = ref(true)
const version = ref(0)

const groupOrder = ['General', 'Blog', 'Email', 'Cache', 'Security', 'Storage', 'Plugin']

const groups = computed<Array<{ label: string, items: SettingItem[] }>>(() => {
  const map = new Map<string, SettingItem[]>()
  for (const s of settings.value) {
    if (!map.has(s.group)) map.set(s.group, [])
    map.get(s.group)!.push(s)
  }
  return [...map.entries()]
    .map(([label, items]) => ({ label, items }))
    .sort((a, b) => {
      const ia = groupOrder.indexOf(a.label)
      const ib = groupOrder.indexOf(b.label)
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib) || a.label.localeCompare(b.label)
    })
})

const activeTab = ref('')

watch(groups, (g) => {
  if (!g.some(gr => gr.label === activeTab.value)) activeTab.value = g[0]?.label ?? ''
}, { immediate: true })

async function load(): Promise<void> {
  loading.value = true
  try {
    const res = await $fetch<Paginated<SettingItem>>('/api/admin/settings', { query: { perPage: 200 } })
    settings.value = res.items
  } catch (e: unknown) {
    notifyError('Failed to load settings', (e as Error).message)
  } finally {
    loading.value = false
  }
}

onMounted(load)
watch(version, load)

/* ---- add-setting dialog ---- */
const addOpen = ref(false)
const addGroup = ref('General')
const { t } = useI18n()

/* ---- smart add-setting form: human label in, key/type inferred ---- */

const newLabel = ref('')
const newValueRaw = ref('')
const newPublic = ref(true)
const newDescription = ref('')

function toKey(label: string): string {
  return label.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '')
}

const newKey = computed(() => toKey(newLabel.value))

const keyTaken = computed(() =>
  settings.value.some(s => s.key === newKey.value)
)

const detectedType = computed<'boolean' | 'number' | 'string'>(() => {
  const raw = newValueRaw.value.trim()
  if (raw === 'true' || raw === 'false') return 'boolean'
  if (raw !== '' && !Number.isNaN(Number(raw))) return 'number'
  return 'string'
})

const parsedValue = computed<string | number | boolean>(() => {
  if (detectedType.value === 'boolean') return newValueRaw.value.trim() === 'true'
  if (detectedType.value === 'number') return Number(newValueRaw.value)
  return newValueRaw.value
})

const addValid = computed(() =>
  newLabel.value.trim().length > 0 && newKey.value.length > 0 && !keyTaken.value
)

async function submitAdd(): Promise<void> {
  if (!addValid.value) return
  await $fetch('/api/admin/settings', {
    method: 'POST',
    body: {
      key: newKey.value,
      value: parsedValue.value,
      type: detectedType.value,
      group: addGroup.value,
      public: newPublic.value,
      description: newDescription.value.trim() || undefined
    }
  })
  notify(`${newKey.value} created`)
  addOpen.value = false
  newLabel.value = ''
  newValueRaw.value = ''
  newPublic.value = true
  newDescription.value = ''
  version.value++
}

function openAdd(group: string): void {
  addGroup.value = group
  newLabel.value = ''
  newValueRaw.value = ''
  newPublic.value = true
  newDescription.value = ''
  addOpen.value = true
}
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-2xl font-semibold tracking-tight">
        {{ t('settings.title') }}
      </h1>
      <p class="text-sm text-muted-foreground">
        {{ t('settings.subtitle') }}
      </p>
    </div>

    <div
      v-if="loading"
      class="space-y-3"
    >
      <UiSkeleton class="h-10 w-96" />
      <UiSkeleton class="h-32 w-full" />
      <UiSkeleton class="h-32 w-full" />
    </div>

    <template v-else-if="groups.length">
      <UiTabs
        v-model="activeTab"
        :tabs="groups.map(g => ({ value: g.label, label: `${g.label} (${g.items.length})` }))"
      />

      <!-- dedicated provider config panel for the Email group -->
      <EmailSettingsPanel
        v-if="activeTab === 'Email'"
        class="mt-4"
        @change="version++"
      />

      <!-- dedicated driver config panel for the Storage group -->
      <DatabaseSettingsPanel
        v-if="activeTab === 'Storage'"
        class="mt-4"
        @change="version++"
      />

      <SettingsGroupForm
        v-for="g in groups"
        v-show="activeTab === g.label && g.label !== 'Email' && g.label !== 'Storage'"
        :key="`${g.label}-${version}`"
        :group="g.label"
        :settings="g.items"
        :can-edit="canEdit"
        class="mt-4"
        @change="version++"
        @add="openAdd"
      />
    </template>

    <UiEmpty v-else>
      <template #title>
        {{ t('settings.noGroups') }}
      </template>
      <UiButton
        v-if="canEdit"
        size="sm"
        @click="openAdd('General')"
      >
        {{ t('common.new') }}
      </UiButton>
    </UiEmpty>

    <!-- smart add-setting dialog -->
    <DialogRoot
      :open="addOpen"
      @update:open="v => (addOpen = v)"
    >
      <DialogPortal>
        <DialogOverlay class="fixed inset-0 z-50 bg-black/60" />
        <DialogContent class="fixed left-1/2 top-1/2 z-50 max-h-[85vh] w-full max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border bg-card p-6 shadow-lg focus:outline-none">
          <DialogTitle class="text-base font-semibold">
            {{ t('settings.newIn', { group: addGroup }) }}
          </DialogTitle>

          <form
            class="mt-5 space-y-5"
            @submit.prevent="submitAdd"
          >
            <!-- name -> auto key -->
            <div class="space-y-1.5">
              <UiLabel for="new-label">
                {{ t('settings.name') }}
              </UiLabel>
              <UiInput
                id="new-label"
                v-model="newLabel"
                :placeholder="t('settings.namePlaceholder')"
              />
              <div class="flex items-center gap-2 text-xs">
                <template v-if="newKey">
                  <span class="text-muted-foreground">{{ t('settings.storedAs') }}</span>
                  <code class="rounded bg-muted px-1.5 py-0.5 font-semibold">{{ newKey }}</code>
                  <span
                    v-if="keyTaken"
                    class="text-destructive"
                  >{{ t('settings.keyTaken') }}</span>
                </template>
              </div>
            </div>

            <!-- smart value -->
            <div class="space-y-1.5">
              <UiLabel for="new-value">
                {{ t('settings.value') }}
              </UiLabel>
              <UiInput
                id="new-value"
                v-model="newValueRaw"
                :placeholder="t('settings.valuePlaceholder')"
              />
              <div class="flex items-center gap-2 text-xs text-muted-foreground">
                <span>{{ t('settings.detectedType') }}</span>
                <UiBadge
                  variant="secondary"
                  class="capitalize"
                >
                  {{ detectedType }}
                </UiBadge>
              </div>
            </div>

            <!-- visibility -->
            <div class="space-y-1.5">
              <UiLabel>{{ t('settings.visibility') }}</UiLabel>
              <div class="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  class="rounded-lg border p-3 text-left transition-colors"
                  :class="newPublic ? 'border-primary bg-primary/5' : 'hover:bg-accent/40'"
                  @click="newPublic = true"
                >
                  <p class="text-sm font-medium">
                    {{ t('settings.public') }}
                  </p>
                  <p class="mt-0.5 text-xs text-muted-foreground">
                    {{ t('settings.publicHint') }}
                  </p>
                </button>
                <button
                  type="button"
                  class="rounded-lg border p-3 text-left transition-colors"
                  :class="!newPublic ? 'border-primary bg-primary/5' : 'hover:bg-accent/40'"
                  @click="newPublic = false"
                >
                  <p class="text-sm font-medium">
                    {{ t('settings.private') }}
                  </p>
                  <p class="mt-0.5 text-xs text-muted-foreground">
                    {{ t('settings.privateHint') }}
                  </p>
                </button>
              </div>
            </div>

            <!-- description -->
            <div class="space-y-1.5">
              <UiLabel for="new-desc">
                {{ t('settings.description') }}
              </UiLabel>
              <UiTextarea
                id="new-desc"
                v-model="newDescription"
                :rows="2"
                :placeholder="t('settings.descPlaceholder')"
              />
            </div>

            <div class="flex justify-end gap-2 border-t pt-4">
              <UiButton
                type="button"
                variant="outline"
                @click="addOpen = false"
              >
                {{ t('common.cancel') }}
              </UiButton>
              <UiButton
                type="submit"
                :disabled="!addValid"
              >
                {{ t('common.save') }}
              </UiButton>
            </div>
          </form>
        </DialogContent>
      </DialogPortal>
    </DialogRoot>
  </div>
</template>
