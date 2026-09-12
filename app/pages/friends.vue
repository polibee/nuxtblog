<script setup lang="ts">
import FriendLinksPage from '~/components/public/FriendLinksPage.vue'

/* Dedicated /friends route (docs/友链.txt §2/71): the friends page is a
   normal Page (template=friend_links) rendered full-width with the
   blogroll grid + submission form. Kept as a static route so the
   full-width layout works on first SSR render. */

definePageMeta({ layout: 'public-full' })

const route = useRoute()
const { localeCode } = useLocale()
const { t } = useI18n()

interface PageDetailData {
  title: string
  alias: string
  content: string
  seoTitle: string
  seoDescription: string
  noindex: boolean
  template: string
  publishedAt: string
}

interface FriendLink {
  id: number
  name: string
  url: string
  domain: string
  description: string
  logoUrl: string | null
  categoryId: number | null
  featured: boolean
  nofollow: boolean
  openInNewTab: boolean
}

const [{ data: page, error }, { data: roll }] = await Promise.all([
  useFetch<PageDetailData>(`/api/public/pages/${route.params.alias ?? 'friends'}`, {
    key: `friends-page-${localeCode.value}`,
    query: { locale: localeCode.value }
  }),
  useFetch<{ links: FriendLink[], categories: Array<{ id: number, name: string }>, site: { name: string, url: string, description: string } | null }>(
    '/api/public/friend-links',
    { key: `friend-links-${localeCode.value}` }
  )
])

if (error.value || !page.value) {
  throw createError({ statusCode: 404, statusMessage: t('public.page.notFound'), fatal: true })
}

useSeoMeta({
  title: () => page.value?.seoTitle || page.value?.title || '',
  description: () => page.value?.seoDescription || '',
  robots: () => (page.value?.noindex ? 'noindex, nofollow' : undefined)
})
</script>

<template>
  <div class="space-y-6">
    <!-- page title/intro come from the Page entity (§2); grid + form from
         the friend-links module -->
    <h1 class="text-3xl font-bold tracking-tight">
      {{ page!.title }}
    </h1>
    <div
      v-if="page!.content && page!.content !== '<p></p>'"
      class="prose prose-neutral dark:prose-invert max-w-none"
    >
      <!-- whitelisted by server-side sanitize-html at write time -->
      <!-- eslint-disable-next-line vue/no-v-html -->
      <div v-html="page!.content" />
    </div>

    <FriendLinksPage
      page-alias="friends"
      :links="roll?.links ?? []"
      :categories="roll?.categories ?? []"
      :site="roll?.site ?? null"
    />
  </div>
</template>
