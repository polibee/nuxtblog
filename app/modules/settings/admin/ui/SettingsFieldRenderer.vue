<script setup lang="ts">
import { useI18n } from '~/admin/i18n'
import MediaPickerField from '~/admin/framework/MediaPickerField.vue'
import { KeyRoundIcon } from 'lucide-vue-next'

/* Field renderer (docs/设置.txt §13/72): one component renders every
   registered field type — pages never hand-write form fields. */

export interface FieldMeta {
  key: string
  type: 'text' | 'textarea' | 'number' | 'switch' | 'select' | 'media' | 'secret'
  label: { zh: string, en: string }
  description?: { zh: string, en: string }
  placeholder?: { zh: string, en: string }
  options?: Array<{ value: string, label: { zh: string, en: string } }>
  required?: boolean
  min?: number
  max?: number
  source: 'environment' | 'database' | 'default'
  value?: string | number | boolean | null
  visibleWhen?: { key: string, equals: string | number | boolean }
  configured?: boolean
  last4?: string
  disabled?: boolean
}

const props = defineProps<{
  field: FieldMeta
  modelValue: string | number | boolean | null
  disabled?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string | number | boolean | null]
  'replace': [value: string]
}>()

const { t, locale } = useI18n()

function label(value: { zh: string, en: string }): string {
  return locale.value === 'en' ? value.en : value.zh
}

const locked = computed(() => props.field.source === 'environment' || props.disabled === true)

/* secret replace flow (§44): stored value never round-trips */
const replacing = ref(false)
const newSecret = ref('')

function startReplace(): void {
  replacing.value = true
  newSecret.value = ''
}

function confirmReplace(): void {
  if (newSecret.value) emit('replace', newSecret.value)
  replacing.value = false
  newSecret.value = ''
}

const mediaId = computed(() => Number(props.modelValue) || null)
</script>

<template>
  <div class="space-y-1">
    <div class="flex items-baseline justify-between gap-3">
      <label class="text-sm font-medium">
        {{ label(field.label) }}
        <span
          v-if="field.required"
          class="text-destructive"
        >*</span>
      </label>
      <span
        v-if="field.source === 'environment'"
        class="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400"
      >
        {{ t('res.settingsui.sourceEnvironment') }}
      </span>
    </div>

    <!-- secret: configured + last4 only (§44) -->
    <template v-if="field.type === 'secret'">
      <div
        v-if="field.configured && !replacing"
        class="flex items-center gap-2"
      >
        <span class="inline-flex h-9 items-center gap-2 rounded-md border bg-muted/50 px-3 text-sm text-muted-foreground">
          <KeyRoundIcon class="h-3.5 w-3.5" />
          ••••••••{{ field.last4 ?? '' }}
        </span>
        <UiButton
          size="sm"
          variant="outline"
          :disabled="locked"
          @click="startReplace"
        >
          {{ t('res.settingsui.secretReplace') }}
        </UiButton>
      </div>
      <div
        v-else
        class="flex items-center gap-2"
      >
        <input
          v-model="newSecret"
          type="password"
          :disabled="locked"
          class="h-9 w-full max-w-md rounded-md border bg-background px-3 text-sm"
          @keydown.enter.prevent="confirmReplace"
        >
        <UiButton
          size="sm"
          :disabled="locked || !newSecret"
          @click="confirmReplace"
        >
          {{ field.configured ? t('res.settingsui.secretReplace') : t('common.save') }}
        </UiButton>
        <UiButton
          v-if="field.configured"
          size="sm"
          variant="ghost"
          @click="replacing = false"
        >
          {{ t('common.cancel') }}
        </UiButton>
      </div>
    </template>

    <!-- media -->
    <template v-else-if="field.type === 'media'">
      <MediaPickerField
        :model-value="mediaId"
        usage="logo"
        :disabled="locked"
        @update:model-value="emit('update:modelValue', $event)"
      />
    </template>

    <!-- switch -->
    <label
      v-else-if="field.type === 'switch'"
      class="flex items-center gap-2"
    >
      <UiSwitch
        :model-value="Boolean(modelValue)"
        :disabled="locked"
        @update:model-value="emit('update:modelValue', $event as boolean)"
      />
      <span class="text-sm text-muted-foreground">{{ Boolean(modelValue) ? t('res.settingsui.on') : t('res.settingsui.off') }}</span>
    </label>

    <!-- select -->
    <select
      v-else-if="field.type === 'select'"
      :value="String(modelValue ?? '')"
      :disabled="locked"
      class="h-9 w-full max-w-md rounded-md border bg-background px-2 text-sm disabled:opacity-60"
      @change="emit('update:modelValue', ($event.target as HTMLSelectElement).value)"
    >
      <option
        v-for="option in field.options ?? []"
        :key="option.value"
        :value="option.value"
      >
        {{ label(option.label) }}
      </option>
    </select>

    <!-- textarea -->
    <textarea
      v-else-if="field.type === 'textarea'"
      :value="String(modelValue ?? '')"
      rows="3"
      :disabled="locked"
      :placeholder="field.placeholder ? label(field.placeholder) : ''"
      class="w-full max-w-2xl rounded-md border bg-background px-3 py-2 text-sm disabled:opacity-60"
      @input="emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
    />

    <!-- number -->
    <input
      v-else-if="field.type === 'number'"
      :value="String(modelValue ?? '')"
      type="number"
      :min="field.min"
      :max="field.max"
      :disabled="locked"
      class="h-9 w-40 rounded-md border bg-background px-3 text-sm disabled:opacity-60"
      @input="emit('update:modelValue', ($event.target as HTMLInputElement).value === '' ? null : Number(($event.target as HTMLInputElement).value))"
    >

    <!-- text -->
    <input
      v-else
      :value="String(modelValue ?? '')"
      type="text"
      :disabled="locked"
      :placeholder="field.placeholder ? label(field.placeholder) : ''"
      class="h-9 w-full max-w-md rounded-md border bg-background px-3 text-sm disabled:opacity-60"
      @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    >

    <p
      v-if="field.description"
      class="max-w-2xl text-xs leading-relaxed text-muted-foreground"
    >
      {{ label(field.description) }}
      <span
        v-if="field.source === 'environment'"
        class="block"
      >{{ t('res.settingsui.envHint') }}</span>
    </p>
  </div>
</template>
