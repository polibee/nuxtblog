<template>
  <article class="space-y-6">
    <header class="space-y-2">
      <h1 class="text-3xl font-bold tracking-tight">
        {{ page.title }}
      </h1>
    </header>

    <!-- whitelisted by server-side sanitize-html at write time -->
    <!-- eslint-disable-next-line vue/no-v-html -->
    <div
      class="prose prose-neutral dark:prose-invert max-w-none"
      v-html="page.content"
    />
  </article>
</template>

<script setup lang="ts">
import type { PublicPageDetail } from '#shared/types/post'

defineProps<{
  page: PublicPageDetail
}>()
</script>
