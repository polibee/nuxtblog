<template>
  <div class="space-y-6">
    <h1 class="text-2xl font-bold tracking-tight">
      {{ t('public.categories.title') }}
    </h1>

    <UiEmpty v-if="categories.length === 0">
      <template #title>
        {{ t('public.taxonomy.empty') }}
      </template>
    </UiEmpty>

    <div class="grid gap-4 sm:grid-cols-2">
      <NuxtLink
        v-for="category in categories"
        :key="category.alias"
        :to="publicPath(`/category/${category.alias}`)"
        class="group rounded-xl border p-5 transition-colors hover:bg-accent/30"
      >
        <p class="font-semibold group-hover:text-primary">
          {{ category.name }}
        </p>
        <p class="mt-1 text-sm text-muted-foreground">
          {{ t('public.archive.browse') }} →
        </p>
      </NuxtLink>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { PublicTaxonomyTerm } from '#shared/types/post'

definePageMeta({ layout: 'public', alias: ['/en/categories'] })

const { t } = useI18n()
const { localeCode, publicPath } = useLocale()

const { data } = await useFetch<{ categories: PublicTaxonomyTerm[] }>(
  '/api/public/categories',
  { key: `categories-page-${localeCode.value}`, query: { locale: localeCode.value } }
)

const categories = computed(() => data.value?.categories ?? [])

useSeoMeta({
  title: () => t('public.categories.title')
})
</script>
