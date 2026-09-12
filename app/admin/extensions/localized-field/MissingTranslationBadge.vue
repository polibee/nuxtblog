<script setup lang="ts">
import TranslationStatus from './TranslationStatus.vue'
import type { TranslationCompleteness } from '#shared/types/locale'

/** compact "missing" flag for table cells and tab headers; renders nothing otherwise */
const props = defineProps<{ status?: TranslationCompleteness }>()

void props
</script>

<template>
  <TranslationStatus
    v-if="props.status === 'missing'"
    status="missing"
    class="ml-1"
  />
</template>
