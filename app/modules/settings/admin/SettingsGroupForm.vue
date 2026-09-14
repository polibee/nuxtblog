<script setup lang="ts">
import { PlusIcon, TrashIcon } from 'lucide-vue-next'
import type { ResolvedResource, SchemaNode } from '~/admin/core/types'

export interface SettingItem {
  id: number
  key: string
  value: string | number | boolean
  type: 'string' | 'text' | 'number' | 'boolean' | 'secret'
  group: string
  public: boolean
  description?: string
}

const props = defineProps<{
  group: string
  settings: SettingItem[]
  canEdit: boolean
}>()

const emit = defineEmits<{
  change: [] // saved or deleted - parent refetches
  add: [group: string] // open "add setting" dialog prefilled with group
}>()

const { t } = useI18n()
const runner = useActionRunner()

const SETTINGS_RESOURCE = {
  name: 'settings',
  label: 'Setting',
  labelPlural: 'Settings',
  permissionPrefix: 'settings'
} as ResolvedResource

function fieldFor(s: SettingItem): SchemaNode {
  const base = { name: s.key, helpText: s.description }
  switch (s.type) {
    case 'text': return textarea(s.key, s.key, { ...base, rows: 3 })
    case 'number': return numberInput(s.key, s.key, base)
    case 'boolean': return switchInput(s.key, s.key)
    case 'secret': return passwordInput(s.key, s.key, { placeholder: '•••••••• (leave empty to keep)' })
    default: return textInput(s.key, s.key, { ...base, placeholder: s.type === 'string' ? String(s.value ?? '') : undefined })
  }
}

const schema = computed<SchemaNode[]>(() => props.settings.map(fieldFor))

const initialValues = computed<Record<string, unknown>>(() => {
  const values: Record<string, unknown> = {}
  for (const s of props.settings) {
    values[s.key] = s.type === 'secret' ? '' : s.value
  }
  return values
})

function coerce(value: unknown, type: SettingItem['type']): string | number | boolean {
  if (type === 'number') return Number(value)
  if (type === 'boolean') return Boolean(value)
  return String(value ?? '')
}

const { submit, submitting } = useFormSchema({
  schema: () => schema.value,
  initialValues: initialValues.value,
  onSubmit: async (values) => {
    const changes = props.settings.filter((s) => {
      if (s.type === 'secret') return String(values[s.key] ?? '') !== ''
      return coerce(values[s.key], s.type) !== s.value
    })
    if (changes.length === 0) {
      notify('No changes to save')
      return
    }
    await Promise.all(changes.map(s =>
      $fetch(`/api/admin/settings/${s.id}`, {
        method: 'PUT',
        body: { value: coerce(values[s.key], s.type) }
      })
    ))
    notify(`${props.group}: ${changes.length} setting(s) saved`)
    emit('change')
  }
})

/* re-hydrate when the parent refetches (new/remounted via :key) */

function confirmDelete(s: SettingItem): void {
  runner.run({
    name: `delete-setting-${s.id}`,
    label: 'Delete',
    icon: 'trash',
    variant: 'destructive',
    confirm: {
      title: `Delete setting "${s.key}"?`,
      description: 'This action cannot be undone.',
      confirmLabel: 'Delete'
    },
    handler: async () => {
      await $fetch(`/api/admin/settings/${s.id}`, { method: 'DELETE' })
      notify(`${s.key} deleted`)
      emit('change')
    }
  }, { resource: SETTINGS_RESOURCE })
}
</script>

<template>
  <form
    class="space-y-4"
    @submit.prevent="submit"
  >
    <div
      v-for="s in settings"
      :key="s.id"
      class="flex flex-col gap-2 rounded-lg border p-4 sm:flex-row sm:items-start"
    >
      <div class="min-w-0 flex-1 space-y-1">
        <div class="flex items-center gap-2">
          <code class="text-xs font-semibold">{{ s.key }}</code>
          <UiBadge
            v-if="s.public"
            variant="success"
          >
            {{ t('settings.public') }}
          </UiBadge>
          <UiBadge
            v-else
            variant="secondary"
          >
            {{ t('settings.private') }}
          </UiBadge>
        </div>
        <p
          v-if="s.description"
          class="text-xs text-muted-foreground"
        >
          {{ s.description }}
        </p>
      </div>
      <div class="w-full sm:max-w-sm">
        <FormSchemaRenderer :schema="[fieldFor(s)]" />
      </div>
      <button
        v-if="canEdit"
        type="button"
        class="self-start rounded p-1 text-muted-foreground transition-colors hover:text-destructive"
        :aria-label="`Delete ${s.key}`"
        @click="confirmDelete(s)"
      >
        <TrashIcon class="h-4 w-4" />
      </button>
    </div>

    <div class="flex items-center justify-between gap-2 border-t pt-4">
      <UiButton
        v-if="canEdit"
        type="button"
        variant="outline"
        size="sm"
        @click="emit('add', group)"
      >
        <PlusIcon /> {{ t('common.new') }}
      </UiButton>
      <UiButton
        v-if="canEdit"
        type="submit"
        :disabled="submitting"
      >
        {{ submitting ? t('common.saving') : t('common.saveChanges') }}
      </UiButton>
    </div>
  </form>
</template>
