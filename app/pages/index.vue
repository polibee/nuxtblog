<template>
  <div class="space-y-10">
    <SiteSlider
      slider-key="home.hero"
      class="mb-2"
    />

    <section class="space-y-4 py-8 text-center">
      <h1 class="text-4xl font-bold tracking-tight">
        {{ siteName }}
      </h1>
      <p class="mx-auto max-w-xl text-muted-foreground">
        {{ siteDescription || t('public.home.subtitle') }}
      </p>
    </section>

    <section class="space-y-4">
      <div class="flex items-center justify-between gap-4">
        <h2 class="text-lg font-semibold tracking-tight">
          {{ t('public.home.latestPosts') }}
        </h2>
        <div
          class="inline-flex shrink-0 rounded-lg border bg-muted/30 p-0.5"
          role="group"
          :aria-label="t('public.home.layoutLabel')"
        >
          <button
            type="button"
            class="rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors"
            :class="postLayout === 'list' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'"
            :aria-pressed="postLayout === 'list'"
            @click="postLayout = 'list'"
          >
            {{ t('public.home.layoutList') }}
          </button>
          <button
            type="button"
            class="rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors"
            :class="postLayout === 'grid' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'"
            :aria-pressed="postLayout === 'grid'"
            @click="postLayout = 'grid'"
          >
            {{ t('public.home.layoutGrid') }}
          </button>
        </div>
      </div>
      <PublicPostList
        :posts="posts"
        :layout="postLayout"
      />
      <PublicPagination
        :page="page"
        :total="total"
        :per-page="perPage"
      />
    </section>
  </div>
</template>

<script setup lang="ts">
import PublicPostList from '~/components/public/PostList.vue'
import PublicPagination from '~/components/public/Pagination.vue'
import SiteSlider from '~/modules/slider/components/SiteSlider.vue'
import type { PublicPostSummary } from '#shared/types/post'

definePageMeta({ layout: 'public', alias: ['/en'] })

const { t } = useI18n()
const { localeCode } = useLocale()
const { siteName, siteDescription } = useSiteSettings()
const postLayout = useCookie<'list' | 'grid'>('home-post-layout', { default: () => 'list' })
const route = useRoute()
const perPage = 10
const page = computed(() => Math.max(Number(route.query.page) || 1, 1))

const { data } = await useFetch<{ items: PublicPostSummary[], total: number }>(
  '/api/public/posts',
  {
    key: computed(() => `home-posts-${localeCode.value}-${page.value}`),
    query: computed(() => ({ locale: localeCode.value, page: page.value, perPage })),
    lazy: true
  }
)

const posts = computed(() => data.value?.items ?? [])
const total = computed(() => data.value?.total ?? 0)

useSeoMeta({
  title: () => t('public.home.title'),
  description: () => siteDescription.value || t('public.home.subtitle')
})
</script>
