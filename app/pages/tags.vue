<template>
  <div class="space-y-6">
    <h1 class="text-2xl font-bold tracking-tight">
      {{ t('public.tags.title') }}
    </h1>

    <p
      v-if="tags.length === 0"
      class="text-sm text-muted-foreground"
    >
      {{ t('public.taxonomy.empty') }}
    </p>

    <div class="flex flex-wrap gap-2">
      <NuxtLink
        v-for="tag in tags"
        :key="tag.alias"
        :to="publicPath(`/tag/${tag.alias}`)"
        class="rounded-full border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        # {{ tag.name }}
      </NuxtLink>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { PublicTaxonomyTerm } from '#shared/types/post'

definePageMeta({ layout: 'public', alias: ['/en/tags'] })

const { t } = useI18n()
const { localeCode, publicPath } = useLocale()

const { data } = await useFetch<{ tags: PublicTaxonomyTerm[] }>(
  '/api/public/tags',
  { key: `tags-page-${localeCode.value}`, query: { locale: localeCode.value } }
)

const tags = computed(() => data.value?.tags ?? [])

useSeoMeta({
  title: () => t('public.tags.title')
})
</script>
