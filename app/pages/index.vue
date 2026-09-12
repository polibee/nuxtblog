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
      <h2 class="text-lg font-semibold tracking-tight">
        {{ t('public.home.latestPosts') }}
      </h2>
      <PublicPostList :posts="posts" />
    </section>
  </div>
</template>

<script setup lang="ts">
import PublicPostList from '~/components/public/PostList.vue'
import SiteSlider from '~/modules/slider/components/SiteSlider.vue'
import type { PublicPostSummary } from '#shared/types/post'

definePageMeta({ layout: 'public' })

const { t } = useI18n()
const { localeCode } = useLocale()
const { siteName, siteDescription } = useSiteSettings()

const { data } = await useFetch<{ items: PublicPostSummary[], total: number }>(
  '/api/public/posts',
  {
    key: `home-posts-${localeCode.value}`,
    query: { locale: localeCode.value, perPage: 10 },
    lazy: true
  }
)

const posts = computed(() => data.value?.items ?? [])

useSeoMeta({
  title: () => t('public.home.title'),
  description: () => siteDescription.value || t('public.home.subtitle')
})
</script>
