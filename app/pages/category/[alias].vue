<template>
  <PublicTaxonomyArchive
    :heading="`${t('public.archive.category')}: ${term?.name ?? String(route.params.alias)}`"
    :description="termDescription"
    :posts="posts"
  />
</template>

<script setup lang="ts">
import PublicTaxonomyArchive from '~/components/public/TaxonomyArchive.vue'
import type { PublicPostSummary } from '#shared/types/post'

definePageMeta({ layout: 'public', alias: ['/en/category/:alias'] })

const route = useRoute()
const { localeCode } = useLocale()
const { t } = useI18n()

const alias = String(route.params.alias)

const { data: categories } = await useFetch<{ categories: Array<{ name: string, alias: string, description?: string }> }>(
  '/api/public/categories',
  { key: `categories-${localeCode.value}`, query: { locale: localeCode.value } }
)
const term = computed(() => categories.value?.categories.find(c => c.alias === alias))

const { data, error } = await useFetch<{ items: PublicPostSummary[], total: number }>(
  '/api/public/posts',
  { key: `category-posts-${alias}-${localeCode.value}`, query: { locale: localeCode.value, category: alias } }
)

if (error.value || !term.value) {
  throw createError({ statusCode: 404, statusMessage: t('public.archive.notFound'), fatal: true })
}

const posts = computed(() => data.value?.items ?? [])
const termDescription = computed(() => {
  const value = (term.value as { description?: string } | undefined)?.description
  return typeof value === 'string' && value ? value : undefined
})

useSeoMeta({
  title: () => `${term.value?.name ?? alias} · ${t('public.archive.category')}`
})
</script>
