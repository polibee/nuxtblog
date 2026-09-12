<script setup lang="ts">
import { useI18n } from '~/admin/i18n'

interface ExportJob {
  id: number
  type: string
  status: string
  dateFrom: string | null
  dateTo: string | null
  rowCount: number
  createdAt: string
  completedAt: string | null
  error: string | null
}

const { t } = useI18n()

const jobs = ref<ExportJob[]>([])
const loading = ref(true)
const error = ref('')
const creating = ref(false)
const form = reactive({
  type: 'orders',
  dateFrom: '',
  dateTo: ''
})

async function load(): Promise<void> {
  loading.value = true
  try {
    const res = await $fetch<{ jobs: ExportJob[] }>('/api/admin/exports')
    jobs.value = res.jobs
    error.value = ''
  } catch (e) {
    error.value = (e as Error).message || t('res.eximp.failed')
  } finally {
    loading.value = false
  }
}

onMounted(load)

async function create(): Promise<void> {
  creating.value = true
  error.value = ''
  try {
    await $fetch('/api/admin/exports', {
      method: 'POST',
      body: {
        type: form.type,
        dateFrom: form.dateFrom || null,
        dateTo: form.dateTo || null
      }
    })
    await load()
  } catch (e) {
    error.value = (e as Error).message || t('res.eximp.failed')
  } finally {
    creating.value = false
  }
}

function statusBadgeClass(job: ExportJob): string {
  if (job.status === 'completed') return 'bg-emerald-500/15 text-emerald-600'
  if (job.status === 'failed') return 'bg-destructive/15 text-destructive'
  return 'bg-amber-500/15 text-amber-600'
}
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-2xl font-semibold tracking-tight">
        {{ t('res.eximp.title') }}
      </h1>
      <p class="mt-1 text-sm text-muted-foreground">
        {{ t('res.eximp.description') }}
      </p>
    </div>

    <p
      v-if="error"
      class="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive"
    >
      {{ error }}
    </p>

    <div class="rounded-lg border bg-card p-5">
      <h2 class="text-sm font-semibold">
        {{ t('res.eximp.create') }}
      </h2>
      <div class="mt-3 grid gap-3 sm:grid-cols-4">
        <div>
          <label class="mb-1 block text-sm font-medium">{{ t('res.eximp.type') }}</label>
          <select
            v-model="form.type"
            class="h-9 w-full rounded-md border bg-background px-2 text-sm"
          >
            <option value="orders">
              {{ t('res.eximp.type.orders') }}
            </option>
            <option value="transactions">
              {{ t('res.eximp.type.transactions') }}
            </option>
            <option value="inventory">
              {{ t('res.eximp.type.inventory') }}
            </option>
          </select>
        </div>
        <div>
          <label class="mb-1 block text-sm font-medium">{{ t('res.eximp.dateFrom') }}</label>
          <input
            v-model="form.dateFrom"
            type="date"
            class="h-9 w-full rounded-md border bg-background px-2 text-sm"
          >
        </div>
        <div>
          <label class="mb-1 block text-sm font-medium">{{ t('res.eximp.dateTo') }}</label>
          <input
            v-model="form.dateTo"
            type="date"
            class="h-9 w-full rounded-md border bg-background px-2 text-sm"
          >
        </div>
        <div class="flex items-end">
          <button
            type="button"
            :disabled="creating"
            class="h-9 w-full rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            @click="create"
          >
            {{ creating ? t('common.saving') : t('res.eximp.run') }}
          </button>
        </div>
      </div>
      <p class="mt-2 text-xs text-muted-foreground">
        {{ t('res.eximp.dateHint') }}
      </p>
    </div>

    <div class="rounded-lg border bg-card">
      <div
        v-if="loading"
        class="py-10 text-center text-sm text-muted-foreground"
      >
        {{ t('common.loading') }}
      </div>
      <div
        v-else-if="jobs.length === 0"
        class="py-10 text-center text-sm text-muted-foreground"
      >
        {{ t('res.eximp.empty') }}
      </div>
      <table
        v-else
        class="w-full text-sm"
      >
        <thead>
          <tr class="border-b text-left text-xs text-muted-foreground">
            <th class="px-4 py-3 font-medium">
              {{ t('res.eximp.col.id') }}
            </th>
            <th class="px-4 py-3 font-medium">
              {{ t('res.eximp.type') }}
            </th>
            <th class="px-4 py-3 font-medium">
              {{ t('res.eximp.col.range') }}
            </th>
            <th class="px-4 py-3 font-medium">
              {{ t('res.eximp.col.rows') }}
            </th>
            <th class="px-4 py-3 font-medium">
              {{ t('res.eximp.col.status') }}
            </th>
            <th class="px-4 py-3 font-medium">
              {{ t('res.eximp.col.createdAt') }}
            </th>
            <th class="px-4 py-3" />
          </tr>
        </thead>
        <tbody class="divide-y">
          <tr
            v-for="job in jobs"
            :key="job.id"
          >
            <td class="px-4 py-3 font-mono text-xs">
              #{{ job.id }}
            </td>
            <td class="px-4 py-3">
              {{ t(`res.eximp.type.${job.type}`) }}
            </td>
            <td class="px-4 py-3 text-xs text-muted-foreground">
              {{ job.dateFrom && job.dateTo ? `${job.dateFrom} ~ ${job.dateTo}` : '—' }}
            </td>
            <td class="px-4 py-3">
              {{ job.status === 'completed' ? job.rowCount : '—' }}
            </td>
            <td class="px-4 py-3">
              <span
                class="rounded px-1.5 py-0.5 text-xs"
                :class="statusBadgeClass(job)"
              >
                {{ t(`res.eximp.status.${job.status}`) }}
              </span>
              <span
                v-if="job.error"
                class="ml-2 text-xs text-destructive"
                :title="job.error"
              >!</span>
            </td>
            <td class="px-4 py-3 text-xs text-muted-foreground">
              {{ new Date(job.createdAt).toLocaleString() }}
            </td>
            <td class="px-4 py-3 text-right">
              <a
                v-if="job.status === 'completed'"
                :href="`/api/admin/exports/${job.id}/download`"
                class="inline-block h-8 rounded-md border px-3 text-xs leading-8 hover:bg-accent"
              >
                {{ t('res.eximp.download') }}
              </a>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
