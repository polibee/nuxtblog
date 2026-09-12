<template>
  <div class="space-y-6">
    <header class="space-y-1">
      <h1 class="text-2xl font-bold tracking-tight">
        {{ heading }}
      </h1>
      <p
        v-if="description"
        class="text-sm text-muted-foreground"
      >
        {{ description }}
      </p>
    </header>
    <PublicPostList :posts="posts" />
  </div>
</template>

<script setup lang="ts">
import PublicPostList from '~/components/public/PostList.vue'
import type { PublicPostSummary } from '#shared/types/post'

const props = defineProps<{
  heading: string
  description?: string
  posts: PublicPostSummary[]
}>()

void props
</script>
