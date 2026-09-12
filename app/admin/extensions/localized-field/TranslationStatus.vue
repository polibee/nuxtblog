<script setup lang="ts">
import { computed } from 'vue'
import UiBadge from '~/admin/ui/UiBadge.vue'
import type { TranslationCompleteness } from '#shared/types/locale'

const props = defineProps<{ status: TranslationCompleteness }>()

const { t } = useI18n()

const variant = computed(() => {
  switch (props.status) {
    case 'complete': return 'success'
    case 'incomplete': return 'warning'
    default: return 'destructive'
  }
})

const label = computed(() => t(`ext.localized.${props.status}`))
</script>

<template>
  <UiBadge :variant="variant">
    {{ label }}
  </UiBadge>
</template>
