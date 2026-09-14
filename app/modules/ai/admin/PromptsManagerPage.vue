<script setup lang="ts">
import { useI18n } from '~/admin/i18n'
import { resolveAdminDisplayLabel } from '~/admin/i18n/display-label'
import { notify, notifyError } from '~/admin/notifications/notify'
import { PlusIcon, CopyIcon, PencilIcon, Trash2Icon } from 'lucide-vue-next'

/* C3 prompt manager (§9/10/31): Built-in + My Presets; built-ins offer
   "Duplicate & Customize" only (§34). Preset = work mode, not a plain
   prompt string (§29-31). */

defineProps<{ resource: { name: string } }>()

const { t } = useI18n()

interface Preset {
  id: number
  name: string
  slug: string
  description: string
  type: 'builtin' | 'custom'
  instructions: string
  defaultScope: string
  defaultDepth: string
  allowedToolGroups: string[] | null
  suggestedQuestions: string[]
  enabled: boolean
  promptVersion: number
}

const presets = ref<Preset[]>([])
const loading = ref(false)
const editing = ref(false)
const form = ref({
  id: null as number | null,
  name: '',
  description: '',
  instructions: '',
  defaultScope: 'site',
  defaultDepth: 'balanced',
  suggestedQuestions: ''
})

const SCOPES = ['site', 'posts', 'pages', 'seo', 'profile', 'store', 'comments', 'media'] as const
const DEPTHS = ['quick', 'balanced', 'deep'] as const

const builtins = computed(() => presets.value.filter(p => p.type === 'builtin'))
const customs = computed(() => presets.value.filter(p => p.type === 'custom'))

async function load(): Promise<void> {
  loading.value = true
  try {
    const res = await $fetch<{ presets: Preset[] }>('/api/admin/ai/presets', { query: { all: 1 } })
    presets.value = res.presets ?? []
  } finally {
    loading.value = false
  }
}

function newPreset(): void {
  editing.value = true
  form.value = { id: null, name: '', description: '', instructions: '', defaultScope: 'site', defaultDepth: 'balanced', suggestedQuestions: '' }
}

function editPreset(preset: Preset): void {
  editing.value = true
  form.value = {
    id: preset.id,
    name: preset.name,
    description: preset.description,
    instructions: preset.instructions,
    defaultScope: preset.defaultScope,
    defaultDepth: preset.defaultDepth,
    suggestedQuestions: preset.suggestedQuestions.join('\n')
  }
}

async function save(): Promise<void> {
  if (!form.value.name.trim() || !form.value.instructions.trim()) {
    notifyError(t('res.aipreset.saveFailed'), t('res.aipreset.required'))
    return
  }
  const body = {
    name: form.value.name,
    description: form.value.description,
    instructions: form.value.instructions,
    defaultScope: form.value.defaultScope,
    defaultDepth: form.value.defaultDepth,
    suggestedQuestions: form.value.suggestedQuestions.split('\n').map(s => s.trim()).filter(Boolean)
  }
  try {
    if (form.value.id) {
      await $fetch(`/api/admin/ai/presets/${form.value.id}`, { method: 'PUT', body })
    } else {
      await $fetch('/api/admin/ai/presets', { method: 'POST', body })
    }
    notify(t('res.aipreset.saved'))
    editing.value = false
    await load()
  } catch (e) {
    notifyError(t('res.aipreset.saveFailed'), (e as Error).message)
  }
}

async function duplicate(preset: Preset): Promise<void> {
  try {
    await $fetch(`/api/admin/ai/presets/${preset.id}/duplicate`, { method: 'POST' })
    notify(t('res.aipreset.saved'))
    await load()
  } catch (e) {
    notifyError(t('res.aipreset.saveFailed'), (e as Error).message)
  }
}

async function remove(preset: Preset): Promise<void> {
  try {
    await $fetch(`/api/admin/ai/presets/${preset.id}`, { method: 'DELETE' })
    await load()
  } catch (e) {
    notifyError(t('res.aipreset.saveFailed'), (e as Error).message)
  }
}

onMounted(load)
</script>

<template>
  <div class="mx-auto max-w-4xl space-y-5">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <h1 class="text-2xl font-semibold tracking-tight">
        {{ t('res.aipreset.label') }}
      </h1>
      <UiButton
        :disabled="loading"
        @click="newPreset"
      >
        <PlusIcon class="mr-1 h-4 w-4" />{{ t('res.aipreset.new') }}
      </UiButton>
    </div>

    <!-- editor (§10) -->
    <div
      v-if="editing"
      class="space-y-3 rounded-xl border p-5"
    >
      <h2 class="text-sm font-semibold">
        {{ form.id ? t('res.aipreset.edit') : t('res.aipreset.new') }}
      </h2>
      <div class="grid gap-3 sm:grid-cols-2">
        <label class="block space-y-1 text-sm">
          <span class="text-muted-foreground">{{ t('res.aipreset.name') }} *</span>
          <input
            v-model="form.name"
            maxlength="80"
            class="h-9 w-full rounded-md border bg-background px-3 text-sm"
          >
        </label>
        <label class="block space-y-1 text-sm">
          <span class="text-muted-foreground">{{ t('res.aipreset.description') }}</span>
          <input
            v-model="form.description"
            maxlength="200"
            class="h-9 w-full rounded-md border bg-background px-3 text-sm"
          >
        </label>
        <label class="block space-y-1 text-sm">
          <span class="text-muted-foreground">{{ t('res.aichat.inspectorScope') }}</span>
          <select
            v-model="form.defaultScope"
            class="h-9 w-full rounded-md border bg-background px-2 text-sm"
          >
            <option
              v-for="s in SCOPES"
              :key="s"
              :value="s"
            >
              {{ resolveAdminDisplayLabel(t, 'aiScope', s) }}
            </option>
          </select>
        </label>
        <label class="block space-y-1 text-sm">
          <span class="text-muted-foreground">{{ t('res.aichat.inspectorDepth') }}</span>
          <select
            v-model="form.defaultDepth"
            class="h-9 w-full rounded-md border bg-background px-2 text-sm"
          >
            <option
              v-for="d in DEPTHS"
              :key="d"
              :value="d"
            >
              {{ resolveAdminDisplayLabel(t, 'aiDepth', d) }}
            </option>
          </select>
        </label>
      </div>
      <label class="block space-y-1 text-sm">
        <span class="text-muted-foreground">{{ t('res.aipreset.instructions') }} *</span>
        <textarea
          v-model="form.instructions"
          rows="5"
          maxlength="8000"
          class="w-full rounded-md border bg-background px-3 py-2 text-sm"
        />
      </label>
      <label class="block space-y-1 text-sm">
        <span class="text-muted-foreground">{{ t('res.aipreset.suggestedQuestions') }}</span>
        <textarea
          v-model="form.suggestedQuestions"
          rows="3"
          :placeholder="t('res.aipreset.suggestedHint')"
          class="w-full rounded-md border bg-background px-3 py-2 text-sm"
        />
      </label>
      <div class="flex justify-end gap-2">
        <UiButton
          variant="outline"
          @click="editing = false"
        >
          {{ t('common.cancel') }}
        </UiButton>
        <UiButton @click="save">
          {{ t('common.save') }}
        </UiButton>
      </div>
    </div>

    <!-- built-in group (§9) -->
    <div class="space-y-2">
      <h2 class="text-sm font-semibold text-muted-foreground">
        {{ t('res.aipreset.builtin') }}
      </h2>
      <div class="grid gap-2 sm:grid-cols-2">
        <div
          v-for="preset in builtins"
          :key="preset.id"
          class="rounded-xl border p-4"
        >
          <div class="flex items-start justify-between gap-2">
            <div class="min-w-0">
              <p class="font-medium">
                {{ preset.name }}
              </p>
              <p class="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                {{ preset.description }}
              </p>
              <p class="mt-1 text-[10px] text-muted-foreground">
                {{ resolveAdminDisplayLabel(t, 'aiScope', preset.defaultScope) }} · {{ resolveAdminDisplayLabel(t, 'aiDepth', preset.defaultDepth) }}
              </p>
            </div>
            <UiButton
              size="sm"
              variant="outline"
              @click="duplicate(preset)"
            >
              <CopyIcon class="h-3.5 w-3.5" />{{ t('res.aipreset.duplicate') }}
            </UiButton>
          </div>
        </div>
      </div>
    </div>

    <!-- my presets (§9) -->
    <div class="space-y-2">
      <h2 class="text-sm font-semibold text-muted-foreground">
        {{ t('res.aipreset.mine') }}
      </h2>
      <p
        v-if="customs.length === 0"
        class="text-xs text-muted-foreground"
      >
        {{ t('res.aipreset.noCustom') }}
      </p>
      <div class="grid gap-2 sm:grid-cols-2">
        <div
          v-for="preset in customs"
          :key="preset.id"
          class="rounded-xl border p-4"
        >
          <div class="flex items-start justify-between gap-2">
            <div class="min-w-0">
              <p class="font-medium">
                {{ preset.name }}
                <span
                  v-if="!preset.enabled"
                  class="ml-1 text-xs text-muted-foreground"
                >({{ t('res.aipreset.disabled') }})</span>
              </p>
              <p class="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                {{ preset.description }}
              </p>
              <p class="mt-1 text-[10px] text-muted-foreground">
                {{ resolveAdminDisplayLabel(t, 'aiScope', preset.defaultScope) }} · {{ resolveAdminDisplayLabel(t, 'aiDepth', preset.defaultDepth) }} · v{{ preset.promptVersion }}
              </p>
            </div>
            <span class="flex shrink-0 gap-1">
              <button
                type="button"
                class="h-7 w-7 rounded-md border hover:bg-accent"
                :title="t('res.aipreset.edit')"
                @click="editPreset(preset)"
              >
                <PencilIcon class="mx-auto h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                class="h-7 w-7 rounded-md border border-destructive/40 text-destructive hover:bg-destructive/10"
                :title="t('res.aichat.delete')"
                @click="remove(preset)"
              >
                <Trash2Icon class="mx-auto h-3.5 w-3.5" />
              </button>
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
