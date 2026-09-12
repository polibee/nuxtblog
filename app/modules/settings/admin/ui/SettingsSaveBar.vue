<script setup lang="ts">
import { useI18n } from '~/admin/i18n'

/* Dirty save bar (docs/设置.txt §7): appears only with unsaved changes;
   sticky bottom. No autosave for SMTP/secrets-class settings (§8). */

defineProps<{ saving: boolean }>()

defineEmits<{
  save: []
  discard: []
}>()

const { t } = useI18n()
</script>

<template>
  <div class="pointer-events-none sticky bottom-4 z-10 flex justify-center">
    <div class="pointer-events-auto flex w-full max-w-2xl items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3 shadow-lg">
      <p class="text-sm font-medium">
        {{ t('res.settingsui.unsaved') }}
      </p>
      <div class="flex items-center gap-2">
        <UiButton
          size="sm"
          variant="ghost"
          :disabled="saving"
          @click="$emit('discard')"
        >
          {{ t('res.settingsui.discard') }}
        </UiButton>
        <UiButton
          size="sm"
          :disabled="saving"
          @click="$emit('save')"
        >
          {{ saving ? t('common.saving') : t('res.settingsui.save') }}
        </UiButton>
      </div>
    </div>
  </div>
</template>
