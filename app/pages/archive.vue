<template>
  <div class="space-y-8">
    <h1 class="text-2xl font-bold tracking-tight">
      {{ t('public.archive.title') }}
    </h1>

    <UiEmpty v-if="items.length === 0">
      <template #title>
        {{ t('public.posts.empty') }}
      </template>
    </UiEmpty>

    <section
      v-for="year in years"
      :key="year.year"
      class="space-y-4"
    >
      <h2 class="text-xl font-semibold tracking-tight">
        {{ year.year }}
      </h2>
      <section
        v-for="month in year.months"
        :key="month.month"
        class="space-y-2 border-l pl-4"
      >
        <h3 class="text-sm font-medium text-muted-foreground">
          {{ monthName(month.month) }}
          <span class="ml-1 font-normal">({{ month.items.length }})</span>
        </h3>
        <ul class="space-y-1">
          <li
            v-for="item in month.items"
            :key="item.alias"
            class="flex items-center gap-3 text-sm"
          >
            <img
              v-if="item.coverUrl"
              :src="item.coverUrl"
              :alt="item.title"
              class="h-10 w-16 shrink-0 rounded object-cover"
              loading="lazy"
            >
            <time class="shrink-0 font-mono text-xs text-muted-foreground">{{ month.month }}-{{ String(item.day).padStart(2, '0') }}</time>
            <NuxtLink
              :to="`/posts/${item.alias}`"
              class="truncate hover:text-primary hover:underline"
            >
              {{ item.title }}
            </NuxtLink>
          </li>
        </ul>
      </section>
    </section>
  </div>
</template>

<script setup lang="ts">
import type { PublicArchiveItem } from '#shared/types/post'

definePageMeta({ layout: 'public' })

const { t } = useI18n()
const { localeCode } = useLocale()

const { data } = await useFetch<{ items: PublicArchiveItem[] }>(
  '/api/public/archive',
  { key: `archive-${localeCode.value}`, query: { locale: localeCode.value } }
)

const items = computed(() => data.value?.items ?? [])

interface MonthGroup { month: number, items: PublicArchiveItem[] }
interface YearGroup { year: number, months: MonthGroup[] }

const years = computed<YearGroup[]>(() => {
  const byYear = new Map<number, MonthGroup[]>()
  for (const item of items.value) {
    const months = byYear.get(item.year) ?? []
    const month = months.find(m => m.month === item.month)
    if (month) month.items.push(item)
    else months.push({ month: item.month, items: [item] })
    byYear.set(item.year, months)
  }
  return [...byYear.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([year, months]) => ({
      year,
      months: months
        .sort((a, b) => b.month - a.month)
        .map(m => ({ month: m.month, items: m.items }))
    }))
})

function monthName(month: number): string {
  return new Date(2026, month - 1, 1).toLocaleDateString(undefined, { month: 'long' })
}

useSeoMeta({
  title: () => t('public.archive.title')
})
</script>
