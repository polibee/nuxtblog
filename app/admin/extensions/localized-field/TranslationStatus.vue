<script setup lang="ts">
import { computed } from 'vue'
import UiBadge from '~/admin/ui/UiBadge.vue'
import type { TranslationCompleteness } from '#shared/types/locale'
import { resolveAdminDisplayLabel } from '~/admin/i18n/display-label'

const props = defineProps<{ status: TranslationCompleteness }>()

const { t } = useI18n()

const variant = computed(() => {
  switch (props.status) {
    case 'complete': return 'success'
    case 'incomplete': return 'warning'
    default: return 'destructive'
  }
})

const label = computed(() => resolveAdminDisplayLabel(t, 'localizedStatus', props.status))
</script>

<template>
  <UiBadge :variant="variant">
    {{ label }}
  </UiBadge>
</template>
