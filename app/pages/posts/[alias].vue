<template>
  <div class="space-y-8">
    <PublicReadingProgress />

    <nav
      class="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground"
      aria-label="Breadcrumb"
    >
      <NuxtLink
        to="/"
        class="hover:text-foreground"
      >
        {{ t('public.nav.home') }}
      </NuxtLink>
      <template
        v-for="category in firstCategory"
        :key="category.alias"
      >
        <span>/</span>
        <NuxtLink
          :to="`/category/${category.alias}`"
          class="hover:text-foreground"
        >
          {{ category.name }}
        </NuxtLink>
      </template>
    </nav>

    <PublicPostDetail
      :post="enriched"
      :reading-minutes="minutes"
    >
      <template #toc-top>
        <PublicArticleToc
          v-if="toc.length >= 3"
          :items="toc"
          class="lg:hidden"
        />
      </template>
    </PublicPostDetail>

    <section
      v-if="detail.authorName"
      class="flex items-center gap-4 rounded-xl border p-5"
    >
      <div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-lg font-semibold text-primary">
        {{ detail.authorName.slice(0, 1).toUpperCase() }}
      </div>
      <div>
        <p class="text-xs uppercase tracking-wide text-muted-foreground">
          {{ t('public.post.author') }}
        </p>
        <p class="font-semibold">
          {{ detail.authorName }}
        </p>
      </div>
    </section>

    <nav
      v-if="detail.neighbors?.prev || detail.neighbors?.next"
      class="grid gap-4 sm:grid-cols-2"
    >
      <NuxtLink
        v-if="detail.neighbors?.prev"
        :to="`/posts/${detail.neighbors.prev.alias}`"
        class="rounded-xl border p-4 transition-colors hover:bg-accent/30"
      >
        <span class="text-xs text-muted-foreground">← {{ t('public.post.prevPost') }}</span>
        <p class="mt-1 line-clamp-2 font-medium leading-snug">
          {{ detail.neighbors.prev.title }}
        </p>
      </NuxtLink>
      <span v-else />
      <NuxtLink
        v-if="detail.neighbors?.next"
        :to="`/posts/${detail.neighbors.next.alias}`"
        class="rounded-xl border p-4 text-right transition-colors hover:bg-accent/30"
      >
        <span class="text-xs text-muted-foreground">{{ t('public.post.nextPost') }} →</span>
        <p class="mt-1 line-clamp-2 font-medium leading-snug">
          {{ detail.neighbors.next.title }}
        </p>
      </NuxtLink>
      <span v-else />
    </nav>

    <section
      v-if="related.length"
      class="space-y-4"
    >
      <h2 class="text-lg font-semibold tracking-tight">
        {{ t('public.post.related') }}
      </h2>
      <div class="grid gap-4 sm:grid-cols-3">
        <NuxtLink
          v-for="item in related"
          :key="item.alias"
          :to="`/posts/${item.alias}`"
          class="group rounded-xl border p-4 transition-colors hover:bg-accent/30"
        >
          <p class="line-clamp-2 font-medium leading-snug group-hover:text-primary">
            {{ item.title }}
          </p>
          <time class="mt-2 block text-xs text-muted-foreground">{{ formatDate(item.publishedAt) }}</time>
        </NuxtLink>
      </div>
    </section>

    <PublicBackToTop />

    <PostComments
      v-if="detail.commentStatus === 'open'"
      :post-alias="detail.alias"
      :comments-open="true"
    />
  </div>
</template>

<script setup lang="ts">
import PublicPostDetail from '~/components/public/PostDetail.vue'
import PublicArticleToc from '~/components/public/ArticleToc.vue'
import PublicReadingProgress from '~/components/public/ReadingProgress.vue'
import PublicBackToTop from '~/components/public/BackToTop.vue'
import PostComments from '~/components/public/PostComments.vue'
import { extractToc, readingMinutes, formatDate } from '~/utils/blog'
import type { PublicPostDetail as PostDetail, PublicPostSummary } from '#shared/types/post'

definePageMeta({ layout: 'public' })

const route = useRoute()
const { localeCode } = useLocale()
const { t } = useI18n()

const { data: post, error } = await useFetch<PostDetail>(
  `/api/public/posts/${route.params.alias}`,
  { key: `post-${String(route.params.alias)}-${localeCode.value}`, query: { locale: localeCode.value } }
)

if (error.value || !post.value) {
  throw createError({ statusCode: 404, statusMessage: t('public.post.notFound'), fatal: true })
}

const detail = computed(() => post.value!)

/* toc ids + reading time; TOC also feeds the sticky aside via shared state */
const extracted = computed(() => extractToc(detail.value.content))
const toc = computed(() => extracted.value.toc)
const enriched = computed(() => ({ ...detail.value, content: extracted.value.html }))
const minutes = computed(() => readingMinutes(detail.value.content))

const tocState = useState<ReturnType<typeof extractToc>['toc'] | null>('article-toc', () => null)
tocState.value = toc.value

const firstCategory = computed(() => detail.value.categories.slice(0, 1))

const related = ref<PublicPostSummary[]>([])
onMounted(async () => {
  const category = detail.value.categories[0]?.alias
  if (!category) return
  const data = await $fetch<{ items: PublicPostSummary[] }>('/api/public/posts', {
    query: { locale: localeCode.value, category, perPage: 4 }
  }).catch(() => null)
  if (data) {
    related.value = data.items.filter(item => item.alias !== detail.value.alias).slice(0, 3)
  }
})

useSeoMeta({
  title: () => post.value?.seoTitle || post.value?.title || '',
  description: () => post.value?.seoDescription || post.value?.excerpt || '',
  robots: () => (post.value?.noindex ? 'noindex, nofollow' : undefined)
})

useHead({
  script: [{
    type: 'application/ld+json',
    innerHTML: JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'Article',
      'headline': detail.value.title,
      'datePublished': detail.value.publishedAt,
      'author': { '@type': 'Person', 'name': detail.value.authorName || '' },
      ...(detail.value.coverUrl ? { image: [detail.value.coverUrl] } : {})
    })
  }]
})
</script>
