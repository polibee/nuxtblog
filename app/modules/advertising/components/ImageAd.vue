<template>
  <component
    :is="payload.targetUrl ? 'a' : 'div'"
    :href="payload.targetUrl"
    target="_blank"
    rel="noopener sponsored"
    class="block min-w-0"
  >
    <img
      v-if="payload.imageUrl"
      :src="payload.imageUrl"
      :alt="payload.altText || payload.title || 'ad'"
      class="h-auto max-h-80 w-full object-cover sm:max-h-96"
    >
    <div
      v-if="payload.title || payload.content"
      class="min-w-0 space-y-1 p-4"
    >
      <p
        v-if="payload.title"
        class="break-words text-sm font-semibold"
      >
        {{ payload.title }}
      </p>
      <p
        v-if="payload.content"
        class="break-words text-xs text-muted-foreground"
      >
        {{ payload.content }}
      </p>
      <span
        v-if="payload.buttonText"
        class="mt-2 inline-block rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground"
      >
        {{ payload.buttonText }}
      </span>
    </div>
  </component>
</template>

<script setup lang="ts">
import type { AdPayload } from '../types/advertising'

defineProps<{
  payload: AdPayload
}>()
</script>
