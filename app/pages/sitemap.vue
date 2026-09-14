<script setup lang="ts">
import { useI18n } from '~/admin/i18n'
import { useLocale } from '~/composables/useLocale'
import { FileTextIcon, FolderTreeIcon, HashIcon, ExternalLinkIcon, MapIcon } from 'lucide-vue-next'

const { t } = useI18n()
const { localeCode, publicPath } = useLocale()

interface PostResponse { items: Array<{ alias: string, title: string }>, total: number }
interface PageResponse { pages: Array<{ alias: string, title: string }> }
interface Term { alias: string, name: string }

const [{ data: posts }, { data: pages }, { data: categories }, { data: tags }] = await Promise.all([
  useFetch<PostResponse>('/api/public/posts', { query: { locale: localeCode.value, perPage: 100 }, key: `sitemap-posts-${localeCode.value}` }),
  useFetch<PageResponse>('/api/public/pages', { query: { locale: localeCode.value }, key: `sitemap-pages-${localeCode.value}` }),
  useFetch<{ categories: Term[] }>('/api/public/categories', { query: { locale: localeCode.value }, key: `sitemap-categories-${localeCode.value}` }),
  useFetch<{ tags: Term[] }>('/api/public/tags', { query: { locale: localeCode.value }, key: `sitemap-tags-${localeCode.value}` })
])

const groups = computed(() => [
  {
    key: 'pages', icon: FileTextIcon, title: t('public.sitemap.pages'), count: pages.value?.pages.length ?? 0,
    items: (pages.value?.pages ?? []).map(page => ({ title: page.title, url: publicPath(`/${page.alias}`) }))
  },
  {
    key: 'posts', icon: MapIcon, title: t('public.sitemap.posts'), count: posts.value?.total ?? 0,
    items: (posts.value?.items ?? []).map(post => ({ title: post.title, url: publicPath(`/posts/${post.alias}`) }))
  },
  {
    key: 'categories', icon: FolderTreeIcon, title: t('public.sitemap.categories'), count: categories.value?.categories.length ?? 0,
    items: (categories.value?.categories ?? []).map(term => ({ title: term.name, url: publicPath(`/category/${term.alias}`) }))
  },
  {
    key: 'tags', icon: HashIcon, title: t('public.sitemap.tags'), count: tags.value?.tags.length ?? 0,
    items: (tags.value?.tags ?? []).map(term => ({ title: term.name, url: publicPath(`/tag/${term.alias}`) }))
  }
])

useSeoMeta({ title: () => t('public.sitemap.title'), description: () => t('public.sitemap.description') })
</script>

<template>
  <div class="mx-auto max-w-6xl space-y-8 py-2">
    <header class="relative overflow-hidden rounded-3xl border bg-card p-6 sm:p-10">
      <div class="absolute -right-16 -top-20 h-56 w-56 rounded-full bg-primary/10 blur-3xl" />
      <div class="relative max-w-2xl">
        <p class="mb-3 text-sm font-medium text-primary">
          {{ t('public.sitemap.eyebrow') }}
        </p>
        <h1 class="text-3xl font-semibold tracking-tight sm:text-5xl">
          {{ t('public.sitemap.title') }}
        </h1>
        <p class="mt-4 text-base leading-7 text-muted-foreground">
          {{ t('public.sitemap.description') }}
        </p>
        <a
          href="/sitemap.xml"
          target="_blank"
          rel="noopener"
          class="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground"
        >
          {{ t('public.sitemap.openXml') }}
          <ExternalLinkIcon class="h-4 w-4" />
        </a>
      </div>
    </header>

    <div class="grid gap-4 sm:grid-cols-4">
      <div
        v-for="group in groups"
        :key="`stat-${group.key}`"
        class="rounded-2xl border bg-card p-4"
      >
        <component
          :is="group.icon"
          class="h-5 w-5 text-primary"
        />
        <p class="mt-4 text-2xl font-semibold">
          {{ group.count }}
        </p>
        <p class="text-sm text-muted-foreground">
          {{ group.title }}
        </p>
      </div>
    </div>

    <section class="grid gap-5 lg:grid-cols-2">
      <article
        v-for="group in groups"
        :key="group.key"
        class="rounded-2xl border bg-card p-5"
      >
        <div class="flex items-center justify-between gap-3 border-b pb-4">
          <div class="flex items-center gap-2">
            <component
              :is="group.icon"
              class="h-5 w-5 text-primary"
            />
            <h2 class="font-semibold">
              {{ group.title }}
            </h2>
          </div>
          <span class="text-xs text-muted-foreground">{{ group.count }}</span>
        </div>
        <div
          v-if="group.items.length"
          class="mt-3 grid gap-1 sm:grid-cols-2"
        >
          <NuxtLink
            v-for="item in group.items"
            :key="item.url"
            :to="item.url"
            class="truncate rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            {{ item.title }}
          </NuxtLink>
        </div>
        <p
          v-else
          class="mt-4 text-sm text-muted-foreground"
        >
          {{ t('public.sitemap.empty') }}
        </p>
      </article>
    </section>
  </div>
</template>
