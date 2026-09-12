<template>
  <div class="space-y-6">
    <h1 class="text-2xl font-bold tracking-tight">
      {{ t('public.search.title') }}
    </h1>

    <form
      class="flex gap-2"
      @submit.prevent="submit"
    >
      <input
        v-model="q"
        type="search"
        :placeholder="t('public.search.placeholder')"
        class="h-10 flex-1 rounded-md border bg-background px-3 text-sm outline-none focus:ring-1 focus:ring-primary"
      >
      <button
        type="submit"
        class="h-10 rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        {{ t('public.search.title') }}
      </button>
    </form>

    <template v-if="submitted">
      <p class="text-sm text-muted-foreground">
        {{ t('public.search.results', { n: total }) }}
      </p>

      <PublicPostList
        :posts="items"
        :highlight="submitted"
      />

      <div
        v-if="items.length === 0"
        class="rounded-xl border p-8 text-center"
      >
        <p class="text-sm text-muted-foreground">
          {{ t('public.search.empty') }}
        </p>
        <div
          v-if="suggestions.length"
          class="mt-4 flex flex-wrap justify-center gap-2"
        >
          <button
            v-for="tag in suggestions"
            :key="tag.alias"
            type="button"
            class="rounded-full border px-3 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            @click="searchFor(tag.name)"
          >
            {{ tag.name }}
          </button>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import PublicPostList from '~/components/public/PostList.vue'
import type { PublicPostSummary, PublicTaxonomyTerm } from '#shared/types/post'

definePageMeta({ layout: 'public' })

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const { localeCode } = useLocale()

const q = ref(String(route.query.q ?? ''))
const submitted = ref(q.value.trim())

const { data } = await useFetch<{ items: PublicPostSummary[], total: number }>(
  '/api/public/posts',
  {
    key: `search-posts-${localeCode.value}`,
    query: computed(() => ({ locale: localeCode.value, q: submitted.value, perPage: 20 }))
  }
)

const items = computed(() => data.value?.items ?? [])
const total = computed(() => data.value?.total ?? 0)

const { data: tagData } = await useFetch<{ tags: PublicTaxonomyTerm[] }>(
  '/api/public/tags',
  { key: `search-tags-${localeCode.value}`, query: { locale: localeCode.value } }
)
const suggestions = computed(() => (tagData.value?.tags ?? []).slice(0, 5))

function submit(): void {
  searchFor(q.value)
}
function searchFor(value: string): void {
  q.value = value
  const term = value.trim()
  submitted.value = term
  router.replace({ path: '/search', query: term ? { q: term } : {} })
}

useSeoMeta({
  title: () => t('public.search.title'),
  robots: 'noindex, nofollow'
})
</script>
