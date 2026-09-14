<template>
  <article
    class="page-detail space-y-8"
    :class="`page-detail--${page.template || 'default'}`"
  >
    <header class="page-detail__header space-y-3">
      <div class="h-1 w-14 rounded-full bg-primary" />
      <h1 class="text-3xl font-bold tracking-tight sm:text-4xl">
        {{ page.title }}
      </h1>
      <time
        v-if="page.publishedAt"
        class="block text-xs text-muted-foreground"
      >
        {{ page.publishedAt.slice(0, 10) }}
      </time>
    </header>

    <!-- whitelisted by server-side sanitize-html at write time -->
    <!-- eslint-disable-next-line vue/no-v-html -->
    <div
      class="page-detail__content prose prose-neutral dark:prose-invert max-w-3xl"
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

<style scoped>
.page-detail__header {
  max-width: 48rem;
}

.page-detail__content :deep(h2) {
  margin-top: 2.25rem;
  scroll-margin-top: 6rem;
}

.page-detail--about .page-detail__header {
  padding: 1.5rem;
  border: 1px solid hsl(var(--border) / 0.65);
  border-radius: 1rem;
  background: linear-gradient(135deg, hsl(var(--primary) / 0.08), transparent 65%);
}

.page-detail--privacy .page-detail__content,
.page-detail--terms .page-detail__content {
  padding: 1.25rem 1.5rem;
  border-left: 3px solid hsl(var(--primary) / 0.35);
}

@media (max-width: 640px) {
  .page-detail--privacy .page-detail__content,
  .page-detail--terms .page-detail__content {
    padding: 0 0 0 1rem;
  }
}
</style>
