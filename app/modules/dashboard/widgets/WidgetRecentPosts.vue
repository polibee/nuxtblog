<script setup lang="ts">
import { FileTextIcon } from 'lucide-vue-next'
import { useI18n } from '~/admin/i18n'

interface RecentPost {
  id: number
  alias: string
  title: string
  status: string
  publishedAt: string | null
  commentCount: number
}

const { t } = useI18n()
const posts = ref<RecentPost[]>([])
const loading = ref(true)

onMounted(async () => {
  try {
    const res = await $fetch<{ recentPosts: RecentPost[] }>('/api/admin/stats')
    posts.value = res.recentPosts
  } catch {
    posts.value = []
  } finally {
    loading.value = false
  }
})

const statusLabel = (status: string): string => {
  const key = `status.${status}`
  const translated = t(key)
  return translated === key ? status : translated
}
</script>

<template>
  <UiCard class="p-5">
    <div class="mb-3 flex items-center justify-between">
      <h3 class="text-sm font-semibold">
        {{ t('widget.recentPosts') }}
      </h3>
      <NuxtLink
        to="/admin/posts"
        class="text-xs text-muted-foreground hover:text-foreground"
      >
        {{ t('widget.viewAll') }}
      </NuxtLink>
    </div>

    <div
      v-if="loading"
      class="space-y-2"
    >
      <UiSkeleton class="h-10 w-full" />
      <UiSkeleton class="h-10 w-full" />
      <UiSkeleton class="h-10 w-3/4" />
    </div>

    <div
      v-else-if="posts.length === 0"
      class="py-6 text-center text-sm text-muted-foreground"
    >
      {{ t('widget.noPosts') }}
    </div>

    <ul
      v-else
      class="space-y-1"
    >
      <li
        v-for="post in posts"
        :key="post.id"
        class="flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-accent/50"
      >
        <div class="flex min-w-0 items-center gap-2">
          <FileTextIcon class="h-4 w-4 shrink-0 text-muted-foreground" />
          <NuxtLink
            :to="`/admin/posts/${post.id}/edit`"
            class="truncate text-sm hover:underline"
          >
            {{ post.title }}
          </NuxtLink>
        </div>
        <div class="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
          <span
            v-if="post.commentCount > 0"
            class="flex items-center gap-0.5"
          >
            💬 {{ post.commentCount }}
          </span>
          <span>{{ statusLabel(post.status) }}</span>
        </div>
      </li>
    </ul>
  </UiCard>
</template>
