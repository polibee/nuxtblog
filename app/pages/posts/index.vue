<template>
  <div class="space-y-6">
    <header class="flex items-center justify-between gap-4">
      <h1 class="text-2xl font-bold tracking-tight">
        {{ t('public.posts.title') }}
      </h1>
      <div class="flex rounded-lg border p-0.5 text-sm">
        <button
          type="button"
          class="rounded-md px-2.5 py-1 transition-colors"
          :class="view === 'list' ? 'bg-accent text-foreground' : 'text-muted-foreground hover:text-foreground'"
          @click="setView('list')"
        >
          ☰
        </button>
        <button
          type="button"
          class="rounded-md px-2.5 py-1 transition-colors"
          :class="view === 'card' ? 'bg-accent text-foreground' : 'text-muted-foreground hover:text-foreground'"
          @click="setView('card')"
        >
          ▦
        </button>
      </div>
    </header>

    <UiEmpty v-if="items.length === 0">
      <template #title>
        {{ t('public.posts.empty') }}
      </template>
    </UiEmpty>

    <PublicPostList
      v-else-if="view === 'list'"
      :posts="items"
    />

    <div
      v-else
      class="grid gap-6 sm:grid-cols-2"
    >
      <article
        v-for="post in items"
        :key="post.alias"
        class="group overflow-hidden rounded-xl border transition-colors hover:bg-accent/30"
      >
        <NuxtLink
          :to="`/posts/${post.alias}`"
          class="block"
        >
          <img
            v-if="post.coverUrl"
            :src="post.coverUrl"
            :alt="post.title"
            loading="lazy"
            class="aspect-[16/10] w-full border-b object-cover transition-transform duration-200 group-hover:scale-[1.02]"
          >
          <div class="space-y-2 p-4">
            <p class="flex items-center gap-1.5 text-xs">
              <span
                v-if="post.categories[0]"
                class="font-medium text-primary/90"
              >{{ post.categories[0].name }}</span>
              <span class="text-muted-foreground/60">·</span>
              <time class="text-muted-foreground">{{ formatDate(post.publishedAt) }}</time>
            </p>
            <h2 class="text-xl font-semibold leading-snug tracking-tight group-hover:text-primary">
              {{ post.title }}
            </h2>
            <p
              v-if="post.excerpt"
              class="line-clamp-2 text-sm leading-relaxed text-muted-foreground"
            >
              {{ post.excerpt }}
            </p>
            <p class="flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
              <span
                v-if="post.authorName"
              >{{ post.authorName }}</span>
              <span
                v-if="post.readingMinutes"
              >· ⏱ {{ t('public.posts.readingTime', { n: post.readingMinutes }) }}</span>
              <span
                v-if="post.views"
              >· 👁 {{ formatViews(post.views) }}</span>
            </p>
          </div>
        </NuxtLink>
      </article>
    </div>

    <PublicPagination
      :page="page"
      :total="total"
      :per-page="perPage"
    />
  </div>
</template>

<script setup lang="ts">
import PublicPostList from '~/components/public/PostList.vue'
import PublicPagination from '~/components/public/Pagination.vue'
import { formatDate, formatViews } from '~/utils/blog'
import type { PublicPostSummary } from '#shared/types/post'

definePageMeta({ layout: 'public' })

const route = useRoute()
const { t } = useI18n()
const { localeCode } = useLocale()

const perPage = 10
const page = computed(() => Math.max(Number(route.query.page) || 1, 1))

const { data } = await useFetch<{ items: PublicPostSummary[], total: number }>(
  '/api/public/posts',
  {
    key: `posts-index-${localeCode.value}`,
    query: computed(() => ({ locale: localeCode.value, page: page.value, perPage }))
  }
)

const items = computed(() => data.value?.items ?? [])
const total = computed(() => data.value?.total ?? 0)

const view = ref<'list' | 'card'>('list')
onMounted(() => {
  const saved = window.localStorage.getItem('public-post-view')
  if (saved === 'card' || saved === 'list') view.value = saved
})
function setView(next: 'list' | 'card'): void {
  view.value = next
  window.localStorage.setItem('public-post-view', next)
}

useSeoMeta({
  title: () => t('public.posts.title'),
  description: () => t('public.posts.subtitle')
})
</script>
