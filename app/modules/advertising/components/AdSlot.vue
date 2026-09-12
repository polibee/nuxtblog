<template>
  <div
    :data-ad-slot="name"
    class="min-h-0"
  >
    <template v-if="resolved">
      <!-- AdRenderer dispatches by payload kind -->
      <AdRenderer
        v-if="result && result.kind !== 'NO_AD'"
        :payload="result"
      />
      <!-- NO_AD renders nothing: the slot collapses entirely -->
    </template>
    <!-- SSR placeholder: empty until client-side resolve lands -->
  </div>
</template>

<script setup lang="ts">
import AdRenderer from './AdRenderer.vue'
import { useAdvertising } from '../composables/useAdvertising'
/* Page-facing component (impl doc §1): pages only declare
   <AdSlot name="...">; all logic lives in useAdvertising + AdRenderer. */

const props = defineProps<{
  /** ad slot key, e.g. "sidebar-ad" */
  name: string
  /** set true on pages that must never show ads */
  disabled?: boolean
}>()

const { result, resolved } = useAdvertising(props.name, { disabled: props.disabled })
</script>
