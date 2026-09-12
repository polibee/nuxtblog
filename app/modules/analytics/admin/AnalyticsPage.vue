<script setup lang="ts">
import { useI18n } from '~/admin/i18n'

interface AnalyticsReport {
  overview: {
    pageviews: number
    sessions: number
    visitors: number
    bounceRate: number
  }
  trend: Array<{ date: string, pageviews: number, sessions: number }>
  sources: Array<{ source: string, pageviews: number }>
  pages: Array<{ path: string, pageviews: number }>
}

const { t } = useI18n()
const report = ref<AnalyticsReport | null>(null)
const loading = ref(true)

const days = ref(7)

async function load(): Promise<void> {
  loading.value = true
  try {
    report.value = await $fetch<AnalyticsReport>(`/api/analytics/report/overview`, {
      query: { days: days.value }
    })
  } catch {
    report.value = null
  } finally {
    loading.value = false
  }
}

onMounted(load)
watch(days, load)

const cards = computed(() => [
  { label: 'Pageviews', value: report.value?.overview.pageviews },
  { label: 'Sessions', value: report.value?.overview.sessions },
  { label: 'Visitors', value: report.value?.overview.visitors },
  { label: 'Bounce Rate', value: report.value ? `${report.value.overview.bounceRate}%` : undefined }
])

const maxPageviews = computed(() =>
  Math.max(...(report.value?.trend ?? []).map(d => d.pageviews), 1)
)
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <h1 class="text-2xl font-semibold tracking-tight">
        {{ t('res.analytics.title') }}
      </h1>
      <div class="flex items-center gap-2">
        <select
          v-model.number="days"
          class="h-9 rounded-md border bg-background px-2 text-sm"
        >
          <option :value="7">
            7 天
          </option>
          <option :value="14">
            14 天
          </option>
          <option :value="30">
            30 天
          </option>
          <option :value="90">
            90 天
          </option>
        </select>
      </div>
    </div>

    <div
      v-if="loading"
      class="space-y-4"
    >
      <div class="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <UiSkeleton class="h-24 w-full" />
        <UiSkeleton class="h-24 w-full" />
        <UiSkeleton class="h-24 w-full" />
        <UiSkeleton class="h-24 w-full" />
      </div>
      <UiSkeleton class="h-64 w-full" />
    </div>

    <template v-else-if="report">
      <div class="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <UiCard
          v-for="card in cards"
          :key="card.label"
          class="p-5"
        >
          <span class="text-xs font-medium text-muted-foreground">{{ card.label }}</span>
          <p class="mt-2 text-2xl font-semibold tabular-nums">
            {{ card.value ?? '—' }}
          </p>
        </UiCard>
      </div>

      <div class="grid gap-6 lg:grid-cols-2">
        <UiCard class="p-5">
          <h3 class="mb-4 text-sm font-semibold">
            {{ t('res.analytics.trend') }}
          </h3>
          <div
            v-if="report.trend.length === 0"
            class="py-8 text-center text-sm text-muted-foreground"
          >
            {{ t('res.analytics.noData') }}
          </div>
          <div
            v-else
            class="space-y-2"
          >
            <div
              v-for="point in report.trend"
              :key="point.date"
              class="flex items-center gap-3"
            >
              <span class="w-20 shrink-0 text-xs text-muted-foreground">{{ point.date }}</span>
              <div class="h-4 flex-1 rounded bg-primary/15">
                <div
                  class="h-full rounded bg-primary/60"
                  :style="{ width: `${Math.min((point.pageviews / maxPageviews) * 100, 100)}%` }"
                />
              </div>
              <span class="w-10 text-right text-xs tabular-nums text-muted-foreground">{{ point.pageviews }}</span>
            </div>
          </div>
        </UiCard>

        <div class="space-y-6">
          <UiCard class="p-5">
            <h3 class="mb-3 text-sm font-semibold">
              {{ t('res.analytics.sources') }}
            </h3>
            <div
              v-if="report.sources.length === 0"
              class="py-4 text-center text-sm text-muted-foreground"
            >
              {{ t('res.analytics.noData') }}
            </div>
            <ul
              v-else
              class="space-y-1 text-sm"
            >
              <li
                v-for="source in report.sources"
                :key="source.source"
                class="flex items-center justify-between rounded px-1 py-0.5"
              >
                <span class="truncate">{{ source.source }}</span>
                <span class="tabular-nums text-muted-foreground">{{ source.pageviews }}</span>
              </li>
            </ul>
          </UiCard>

          <UiCard class="p-5">
            <h3 class="mb-3 text-sm font-semibold">
              {{ t('res.analytics.topPages') }}
            </h3>
            <div
              v-if="report.pages.length === 0"
              class="py-4 text-center text-sm text-muted-foreground"
            >
              {{ t('res.analytics.noData') }}
            </div>
            <ul
              v-else
              class="space-y-1 text-sm"
            >
              <li
                v-for="page in report.pages"
                :key="page.path"
                class="flex items-center justify-between rounded px-1 py-0.5"
              >
                <span class="truncate">{{ page.path }}</span>
                <span class="tabular-nums text-muted-foreground">{{ page.pageviews }}</span>
              </li>
            </ul>
          </UiCard>
        </div>
      </div>
    </template>
  </div>
</template>
