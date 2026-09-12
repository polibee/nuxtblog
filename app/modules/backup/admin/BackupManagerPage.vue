<script setup lang="ts">
import { useI18n } from '~/admin/i18n'
import { notify, notifyError } from '~/admin/notifications/notify'

/* P14 Backup manager: create full-site ZIP backups, download them,
   upload a ZIP for restore preview and run a Replace restore after
   typing the RESTORE confirmation word (§21). */

defineProps<{ resource: { name: string } }>()

const { t } = useI18n()

interface BackupJob {
  id: number
  status: string
  fileKey: string | null
  fileSize: number | null
  manifestVersion: string | null
  includesMedia: boolean
  createdAt: string
}

interface RestorePreview {
  manifest: {
    format: string
    version: string
    createdAt: string
    defaultLocale: string
    locales: string[]
    includesMedia: boolean
    counts: Record<string, number>
  }
  valid: boolean
  problems: string[]
}

const jobs = ref<BackupJob[]>([])
const loading = ref(false)
const creating = ref(false)
const error = ref('')

const restoreFile = ref<File | null>(null)
const preview = ref<RestorePreview | null>(null)
const confirmText = ref('')
const restoring = ref(false)

function formatSize(bytes: number | null): string {
  if (!bytes) return '—'
  if (bytes >= 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + ' MB'
  return Math.max(Math.round(bytes / 1024), 1) + ' KB'
}

async function loadJobs(): Promise<void> {
  loading.value = true
  try {
    const res = await $fetch<{ jobs: BackupJob[] }>('/api/admin/backup')
    jobs.value = res.jobs
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    loading.value = false
  }
}

async function createBackup(): Promise<void> {
  creating.value = true
  try {
    const res = await $fetch<{ job: BackupJob }>('/api/admin/backup', { method: 'POST' })
    notify(t('res.backup.created'))
    await loadJobs()
    await download(res.job.id)
  } catch (e) {
    notifyError(t('res.backup.failed'), (e as Error).message)
  } finally {
    creating.value = false
  }
}

async function download(id: number): Promise<void> {
  const res = await $fetch<Blob>(`/api/admin/backup/${id}/download`)
  const url = URL.createObjectURL(res)
  const link = document.createElement('a')
  link.href = url
  link.download = `backup-${id}.zip`
  link.click()
  URL.revokeObjectURL(url)
}

async function onFileChange(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  restoreFile.value = input.files?.[0] ?? null
  preview.value = null
  if (!restoreFile.value) return
  try {
    const body = new FormData()
    body.append('file', restoreFile.value)
    preview.value = await $fetch<RestorePreview>('/api/admin/backup/preview', { method: 'POST', body })
  } catch (e) {
    notifyError(t('res.backup.previewFailed'), (e as Error).message)
  }
}

async function runRestore(): Promise<void> {
  if (!restoreFile.value || confirmText.value !== 'RESTORE') return
  restoring.value = true
  try {
    const body = new FormData()
    body.append('file', restoreFile.value)
    body.append('confirm', confirmText.value)
    const res = await $fetch<{ restored: Record<string, number> }>('/api/admin/backup/restore', { method: 'POST', body })
    const total = Object.values(res.restored).reduce((a, b) => a + b, 0)
    notify(t('res.backup.restored', { n: total }))
    preview.value = null
    confirmText.value = ''
    restoreFile.value = null
  } catch (e) {
    notifyError(t('res.backup.restoreFailed'), (e as Error).message)
  } finally {
    restoring.value = false
  }
}

onMounted(loadJobs)
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <h1 class="text-2xl font-semibold tracking-tight">
        {{ t('res.backup.label') }}
      </h1>
      <UiButton
        :disabled="creating"
        @click="createBackup"
      >
        {{ creating ? t('common.saving') : t('res.backup.create') }}
      </UiButton>
    </div>

    <p class="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
      {{ t('res.backup.hint') }}
    </p>

    <p
      v-if="error"
      class="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive"
    >
      {{ error }}
    </p>

    <!-- history -->
    <div class="overflow-x-auto rounded-xl border">
      <table class="w-full text-sm">
        <thead class="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th class="px-4 py-3">
              {{ t('res.backup.col.id') }}
            </th>
            <th class="px-4 py-3">
              {{ t('res.backup.col.created') }}
            </th>
            <th class="px-4 py-3">
              {{ t('res.media.drawer.size') }}
            </th>
            <th class="px-4 py-3">
              {{ t('res.backup.col.version') }}
            </th>
            <th class="px-4 py-3 text-right">
              {{ t('res.adcampaigns.actions') }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="jobs.length === 0">
            <td
              colspan="5"
              class="px-4 py-10 text-center text-muted-foreground"
            >
              {{ t('res.backup.empty') }}
            </td>
          </tr>
          <tr
            v-for="job in jobs"
            :key="job.id"
            class="border-t"
          >
            <td class="px-4 py-3 font-medium">
              #{{ job.id }}
            </td>
            <td class="px-4 py-3">
              {{ new Date(job.createdAt).toLocaleString() }}
            </td>
            <td class="px-4 py-3">
              {{ formatSize(job.fileSize) }}
            </td>
            <td class="px-4 py-3 text-xs text-muted-foreground">
              v{{ job.manifestVersion }}
            </td>
            <td class="px-4 py-3 text-right">
              <button
                type="button"
                class="h-8 rounded-md border px-3 text-xs hover:bg-accent"
                @click="download(job.id)"
              >
                {{ t('res.backup.download') }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- restore -->
    <div class="space-y-3 rounded-xl border border-warning/40 p-5">
      <h2 class="text-sm font-semibold tracking-wide">
        {{ t('res.backup.restore') }}
      </h2>
      <p class="text-xs text-muted-foreground">
        {{ t('res.backup.restoreHint') }}
      </p>
      <input
        type="file"
        accept=".zip"
        class="block text-sm"
        @change="onFileChange"
      >

      <div
        v-if="preview"
        class="space-y-3 rounded-lg border p-4"
      >
        <div class="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
          <p>{{ t('res.backup.col.version') }}: <span class="text-foreground">v{{ preview.manifest.version }}</span></p>
          <p>{{ t('res.media.drawer.uploaded') }}: <span class="text-foreground">{{ new Date(preview.manifest.createdAt).toLocaleString() }}</span></p>
          <p>{{ t('res.backup.col.locales') }}: <span class="text-foreground">{{ preview.manifest.locales.join(', ') }}</span></p>
          <p>{{ t('public.store.factsStock') }}: <span class="text-foreground">{{ preview.valid ? 'READY' : t('res.backup.invalid') }}</span></p>
        </div>
        <ul
          v-if="preview.problems.length"
          class="space-y-0.5 text-xs text-destructive"
        >
          <li
            v-for="(problem, i) in preview.problems"
            :key="i"
          >
            ⚠ {{ problem }}
          </li>
        </ul>
        <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-4">
          <p
            v-for="(count, key) in preview.manifest.counts"
            :key="key"
          >
            <span class="text-muted-foreground">{{ key }}:</span>
            <span class="font-medium text-foreground">{{ count }}</span>
          </p>
        </div>

        <label class="block space-y-1 text-sm">
          <span class="text-muted-foreground">{{ t('res.backup.confirmHint') }}</span>
          <input
            v-model="confirmText"
            class="h-9 w-48 rounded-md border bg-background px-3 text-sm"
            placeholder="RESTORE"
          >
        </label>
        <UiButton
          variant="destructive"
          :disabled="confirmText !== 'RESTORE' || restoring"
          @click="runRestore"
        >
          {{ restoring ? t('common.saving') : t('res.backup.restoreNow') }}
        </UiButton>
      </div>
    </div>
  </div>
</template>
