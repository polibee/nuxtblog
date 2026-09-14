<template>
  <PublicTaxonomyArchive
    :heading="`# ${term?.name ?? String(route.params.alias)}`"
    :posts="posts"
  />
</template>

<script setup lang="ts">
import PublicTaxonomyArchive from '~/components/public/TaxonomyArchive.vue'
import type { PublicPostSummary } from '#shared/types/post'

definePageMeta({ layout: 'public', alias: ['/en/tag/:alias'] })

const route = useRoute()
const { localeCode } = useLocale()
const { t } = useI18n()

const alias = String(route.params.alias)

const { data: tags } = await useFetch<{ tags: Array<{ name: string, alias: string }> }>(
  '/api/public/tags',
  { key: `tags-${localeCode.value}`, query: { locale: localeCode.value } }
)
const term = computed(() => tags.value?.tags.find(tag => tag.alias === alias))

const { data, error } = await useFetch<{ items: PublicPostSummary[], total: number }>(
  '/api/public/posts',
  { key: `tag-posts-${alias}-${localeCode.value}`, query: { locale: localeCode.value, tag: alias } }
)

if (error.value || !term.value) {
  throw createError({ statusCode: 404, statusMessage: t('public.archive.notFound'), fatal: true })
}

const posts = computed(() => data.value?.items ?? [])

useSeoMeta({
  title: () => `#${term.value?.name ?? alias}`
})
</script>
