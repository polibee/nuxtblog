<script setup lang="ts">
import { useI18n } from '~/admin/i18n'

defineProps<{ resource: { name: string } }>()
const { t } = useI18n()
const loading = ref(true)
const error = ref('')
const usage = ref<AiUsageReport | null>(null)
const requests = ref<AiRequest[]>([])

interface AiRequest { id: number, feature: string, model: string, status: string, inputTokens: number | null, outputTokens: number | null, latencyMs: number | null, errorCode: string | null, cacheStatus?: string, savedTokens?: number | null }
interface AiUsageReport {
  overview: { requests: number, successful: number, failed: number, inputTokens: number, outputTokens: number, totalTokens: number, cacheHits: number, cacheHitRate: number, savedTokens: number, estimatedCostMicros: number, averageLatencyMs: number }
  models: Array<{ model: string, requests: number, inputTokens: number, outputTokens: number, costMicros: number }>
  features: Array<{ feature: string, requests: number, costMicros: number }>
}

const formatTokens = (value: number) => new Intl.NumberFormat().format(value)
const formatCost = (micros: number) => `$${(micros / 1_000_000).toFixed(4)}`

async function load(): Promise<void> {
  loading.value = true
  try {
    const [report, recent] = await Promise.all([
      $fetch<{ report: AiUsageReport }>('/api/admin/ai/usage', { query: { days: 30 } }),
      $fetch<{ requests: AiRequest[] }>('/api/admin/ai/requests')
    ])
    usage.value = report.report
    requests.value = recent.requests
    error.value = ''
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    loading.value = false
  }
}
onMounted(load)
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-2xl font-semibold tracking-tight">
        {{ t('res.ai.analytics') }}
      </h1>
      <p class="mt-1 text-sm text-muted-foreground">
        {{ t('res.ai.analyticsHint') }}
      </p>
    </div>
    <p
      v-if="error"
      class="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive"
    >
      {{ error }}
    </p>
    <div
      v-if="loading"
      class="rounded-xl border p-8 text-center text-sm text-muted-foreground"
    >
      {{ t('common.loading') }}
    </div>
    <template v-else>
      <div class="grid grid-cols-2 gap-3 xl:grid-cols-5">
        <UiCard class="p-4">
          <span class="text-xs text-muted-foreground">{{ t('res.ai.metricRequests') }}</span><p class="mt-1 text-xl font-semibold">
            {{ formatTokens(usage?.overview.requests ?? 0) }}
          </p><span class="text-[11px] text-muted-foreground">{{ usage?.overview.failed ?? 0 }} {{ t('res.ai.failed') }}</span>
        </UiCard>
        <UiCard class="p-4">
          <span class="text-xs text-muted-foreground">{{ t('res.ai.metricTokens') }}</span><p class="mt-1 text-xl font-semibold">
            {{ formatTokens(usage?.overview.totalTokens ?? 0) }}
          </p>
        </UiCard>
        <UiCard class="p-4">
          <span class="text-xs text-muted-foreground">{{ t('res.ai.metricCache') }}</span><p class="mt-1 text-xl font-semibold">
            {{ usage?.overview.cacheHitRate ?? 0 }}%
          </p><span class="text-[11px] text-muted-foreground">{{ formatTokens(usage?.overview.savedTokens ?? 0) }} {{ t('res.ai.savedTokens') }}</span>
        </UiCard>
        <UiCard class="p-4">
          <span class="text-xs text-muted-foreground">{{ t('res.ai.metricCost') }}</span><p class="mt-1 text-xl font-semibold">
            {{ formatCost(usage?.overview.estimatedCostMicros ?? 0) }}
          </p>
        </UiCard>
        <UiCard class="p-4">
          <span class="text-xs text-muted-foreground">{{ t('res.ai.metricLatency') }}</span><p class="mt-1 text-xl font-semibold">
            {{ usage?.overview.averageLatencyMs ?? 0 }}ms
          </p>
        </UiCard>
      </div>
      <div class="grid gap-4 lg:grid-cols-2">
        <UiCard class="overflow-hidden">
          <div class="border-b px-4 py-3 text-sm font-semibold">
            {{ t('res.ai.byModel') }}
          </div><div class="divide-y">
            <div
              v-for="model in usage?.models"
              :key="model.model"
              class="flex justify-between gap-3 px-4 py-2.5 text-xs"
            >
              <span class="truncate font-medium">{{ model.model }}</span><span class="shrink-0 text-muted-foreground">{{ model.requests }} · {{ formatTokens(model.inputTokens + model.outputTokens) }} tok · {{ formatCost(model.costMicros) }}</span>
            </div><p
              v-if="!usage?.models.length"
              class="p-6 text-center text-xs text-muted-foreground"
            >
              {{ t('res.ai.noUsage') }}
            </p>
          </div>
        </UiCard>
        <UiCard class="overflow-hidden">
          <div class="border-b px-4 py-3 text-sm font-semibold">
            {{ t('res.ai.byFeature') }}
          </div><div class="divide-y">
            <div
              v-for="feature in usage?.features"
              :key="feature.feature"
              class="flex justify-between gap-3 px-4 py-2.5 text-xs"
            >
              <span class="truncate font-medium">{{ feature.feature }}</span><span class="shrink-0 text-muted-foreground">{{ feature.requests }} · {{ formatCost(feature.costMicros) }}</span>
            </div><p
              v-if="!usage?.features.length"
              class="p-6 text-center text-xs text-muted-foreground"
            >
              {{ t('res.ai.noUsage') }}
            </p>
          </div>
        </UiCard>
      </div>
      <UiCard class="overflow-hidden">
        <div class="border-b px-4 py-3 text-sm font-semibold">
          {{ t('res.ai.usage') }}
        </div><div class="divide-y">
          <div
            v-for="request in requests"
            :key="request.id"
            class="flex flex-wrap justify-between gap-2 px-4 py-2 text-xs"
          >
            <span class="font-medium">{{ request.feature }}</span><span class="text-muted-foreground">{{ request.status }} · {{ request.model }} · {{ request.inputTokens ?? 0 }}/{{ request.outputTokens ?? 0 }} tok · {{ request.latencyMs ?? 0 }}ms</span>
          </div><p
            v-if="!requests.length"
            class="p-6 text-center text-xs text-muted-foreground"
          >
            {{ t('res.ai.noUsage') }}
          </p>
        </div>
      </UiCard>
    </template>
  </div>
</template>
