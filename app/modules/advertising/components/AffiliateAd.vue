<template>
  <a
    :href="payload.targetUrl"
    target="_blank"
    rel="noopener sponsored nofollow"
    class="block"
  >
    <img
      v-if="payload.imageUrl"
      :src="payload.imageUrl"
      :alt="payload.altText || payload.title || 'ad'"
      class="w-full object-cover"
    >
    <div
      v-if="payload.title || payload.content"
      class="space-y-1 p-4"
    >
      <p
        v-if="payload.title"
        class="text-sm font-semibold"
      >
        {{ payload.title }}
      </p>
      <p
        v-if="payload.content"
        class="text-xs text-muted-foreground"
      >
        {{ payload.content }}
      </p>
      <span
        v-if="payload.buttonText"
        class="mt-2 inline-block rounded-md border border-primary px-3 py-1 text-xs font-medium text-primary"
      >
        {{ payload.buttonText }} ↗
      </span>
    </div>
  </a>
</template>

<script setup lang="ts">
import type { AdPayload } from '../types/advertising'

defineProps<{
  payload: AdPayload
}>()
</script>
