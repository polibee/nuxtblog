<script setup lang="ts">
import {
  CheckCircle2Icon,
  DatabaseIcon,
  PlugZapIcon,
  SendIcon,
  ServerIcon,
  Trash2Icon
} from 'lucide-vue-next'
import { cn } from '~/admin/utils/cn'

interface DbConfigView {
  driver: 'memory' | 'postgres' | 'mysql' | 'supabase'
  hasUrl: boolean
  host: string
  port: number
  database: string
  user: string
  hasPassword: boolean
  ssl: boolean
  seedDemo: boolean
  activeKind: string
}

const emit = defineEmits<{ change: [] }>()

const { t } = useI18n()
const allow = useCan()
const canEdit = computed(() => allow('settings.edit'))

const drivers = [
  { value: 'memory', label: 'Memory', icon: ServerIcon, hint: 'In-memory demo store (default)' },
  { value: 'postgres', label: 'PostgreSQL', icon: DatabaseIcon, hint: 'Self-hosted or any PG cloud' },
  { value: 'supabase', label: 'Supabase', icon: DatabaseIcon, hint: 'PostgreSQL via connection string · SSL on' },
  { value: 'mysql', label: 'MySQL', icon: DatabaseIcon, hint: 'MySQL 8+ / compatible' }
] as const

const config = ref<DbConfigView | null>(null)
const url = ref('')
const password = ref('')
const redis = ref({ url: '', host: 'localhost', port: 6379, password: '' })
const saving = ref(false)
const loading = ref(true)
const result = ref<{ ok: boolean, message: string } | null>(null)
const restartNeeded = ref(false)
const cleanupCounts = ref<{ posts: number, comments: number, campaigns: number, creatives: number, media: number } | null>(null)
const cleaning = ref(false)

onMounted(async () => {
  await load()
  if (canEdit.value) await loadCleanupCounts()
})

async function load(): Promise<void> {
  loading.value = true
  try {
    config.value = await $fetch<DbConfigView>('/api/admin/database/config')
  } catch (e: unknown) {
    notifyError(t('mail.loadFailed'), (e as Error).message)
  } finally {
    loading.value = false
  }
}

async function loadCleanupCounts(): Promise<void> {
  try {
    const response = await $fetch<{ counts: NonNullable<typeof cleanupCounts.value> }>('/api/admin/database/test-data')
    cleanupCounts.value = response.counts
  } catch {
    cleanupCounts.value = null
  }
}

async function cleanup(): Promise<void> {
  if (!window.confirm(t('db.cleanupConfirm'))) return
  cleaning.value = true
  result.value = null
  try {
    const response = await $fetch<{ cleaned: NonNullable<typeof cleanupCounts.value> }>('/api/admin/database/test-data', {
      method: 'POST',
      body: { confirm: true }
    })
    cleanupCounts.value = { posts: 0, comments: 0, campaigns: 0, creatives: 0, media: 0 }
    result.value = { ok: true, message: t('db.cleanupDone', response.cleaned) }
  } catch (e: unknown) {
    const err = e as { data?: { statusMessage?: string } }
    result.value = { ok: false, message: err?.data?.statusMessage ?? (e as Error).message }
  } finally {
    cleaning.value = false
  }
}

async function save(): Promise<void> {
  if (!config.value) return
  saving.value = true
  result.value = null
  try {
    await $fetch('/api/admin/database/config', {
      method: 'POST',
      body: {
        driver: config.value.driver,
        url: url.value || undefined,
        host: config.value.host,
        port: config.value.port,
        database: config.value.database,
        user: config.value.user,
        password: password.value || undefined,
        ssl: config.value.ssl,
        seedDemo: config.value.seedDemo
      }
    })
    result.value = { ok: true, message: t('db.savedRestart') }
    restartNeeded.value = true
    emit('change')
  } catch (e: unknown) {
    const err = e as { data?: { statusMessage?: string } }
    result.value = { ok: false, message: err?.data?.statusMessage ?? (e as Error).message }
  } finally {
    saving.value = false
  }
}

async function test(target: 'database' | 'cache'): Promise<void> {
  result.value = null
  try {
    const res = await $fetch<{ kind: string }>('/api/admin/database/test', {
      method: 'POST',
      body: {
        target,
        driver: target === 'cache' ? 'redis' : config.value?.driver,
        url: target === 'cache' ? redis.value.url || undefined : url.value || undefined,
        host: target === 'cache' ? redis.value.host : config.value?.host,
        port: target === 'cache' ? redis.value.port : config.value?.port,
        database: config.value?.database,
        user: config.value?.user,
        password: password.value || undefined,
        ssl: config.value?.ssl
      }
    })
    result.value = { ok: true, message: t('db.testOk', { kind: res.kind }) }
  } catch (e: unknown) {
    const err = e as { data?: { statusMessage?: string } }
    result.value = { ok: false, message: err?.data?.statusMessage ?? (e as Error).message }
  }
}
</script>

<template>
  <div
    v-if="loading"
    class="space-y-3 py-2"
  >
    <UiSkeleton class="h-16 w-full" />
    <UiSkeleton class="h-32 w-full" />
  </div>

  <form
    v-else-if="config"
    class="space-y-5"
    @submit.prevent="save"
  >
    <UiAlert variant="info">
      {{ t('db.activeDriver', { kind: config.activeKind }) }} · {{ t('db.restartHint') }}
    </UiAlert>

    <!-- driver cards -->
    <div class="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
      <button
        v-for="d in drivers"
        :key="d.value"
        type="button"
        :disabled="!canEdit"
        :class="cn(
          'flex items-start gap-3 rounded-xl border p-4 text-left transition-all disabled:opacity-60',
          config.driver === d.value ? 'border-primary bg-primary/5 ring-1 ring-primary/30' : 'hover:bg-accent/40'
        )"
        @click="config!.driver = d.value"
      >
        <component
          :is="d.icon"
          class="mt-0.5 h-5 w-5 shrink-0"
          :class="config.driver === d.value ? 'text-primary' : 'text-muted-foreground'"
        />
        <span class="min-w-0">
          <span class="block text-sm font-semibold">{{ d.label }}</span>
          <span class="mt-0.5 block text-xs text-muted-foreground">{{ d.hint }}</span>
        </span>
      </button>
    </div>

    <!-- SQL connection -->
    <div
      v-if="config.driver !== 'memory'"
      class="rounded-xl border p-4"
    >
      <h3 class="mb-3 text-sm font-semibold">
        {{ t('db.connection') }}
      </h3>
      <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div class="space-y-1.5 md:col-span-2">
          <UiLabel>{{ t('db.connUrl') }}</UiLabel>
          <UiInput
            v-model="url"
            :placeholder="config.hasUrl ? t('mail.keepSecret') : 'postgres://user:pass@host:5432/db'"
          />
          <p class="text-xs text-muted-foreground">
            {{ t('db.connUrlHint') }}
          </p>
        </div>
        <template v-if="!url">
          <div class="space-y-1.5">
            <UiLabel>{{ t('db.host') }}</UiLabel>
            <UiInput
              v-model="config.host"
              placeholder="localhost"
            />
          </div>
          <div class="space-y-1.5">
            <UiLabel>{{ t('db.port') }}</UiLabel>
            <UiInput
              v-model="config.port as unknown as string"
              type="number"
            />
          </div>
          <div class="space-y-1.5">
            <UiLabel>{{ t('db.name') }}</UiLabel>
            <UiInput
              v-model="config.database"
              placeholder="nuxt_admin"
            />
          </div>
          <div class="space-y-1.5">
            <UiLabel>{{ t('db.user') }}</UiLabel>
            <UiInput
              v-model="config.user"
              autocomplete="off"
            />
          </div>
          <div class="space-y-1.5">
            <UiLabel>{{ t('mail.password') }}</UiLabel>
            <UiInput
              v-model="password"
              type="password"
              autocomplete="new-password"
              :placeholder="config.hasPassword ? t('mail.keepSecret') : '••••••••'"
            />
          </div>
          <div class="flex items-center">
            <UiSwitch v-model="config.ssl">
              <span class="text-sm">SSL</span>
            </UiSwitch>
          </div>
        </template>
      </div>
      <div class="mt-3 flex items-center justify-between gap-3">
        <UiSwitch v-model="config.seedDemo">
          <span class="text-sm">{{ t('db.seedDemo') }}</span>
        </UiSwitch>
        <UiButton
          type="button"
          variant="outline"
          size="sm"
          :disabled="!canEdit"
          @click="test('database')"
        >
          <PlugZapIcon /> {{ t('db.testConn') }}
        </UiButton>
      </div>
    </div>

    <!-- Redis -->
    <div class="rounded-xl border p-4">
      <h3 class="mb-1 text-sm font-semibold">
        Redis · {{ t('db.cache') }}
      </h3>
      <p class="mb-3 text-xs text-muted-foreground">
        {{ t('db.redisHint') }}
      </p>
      <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div class="space-y-1.5 md:col-span-2">
          <UiLabel>REDIS_URL</UiLabel>
          <UiInput
            v-model="redis.url"
            placeholder="redis://:pass@host:6379/0"
          />
        </div>
        <div class="space-y-1.5">
          <UiLabel>{{ t('db.host') }}</UiLabel>
          <UiInput v-model="redis.host" />
        </div>
        <div class="space-y-1.5">
          <UiLabel>{{ t('db.port') }}</UiLabel>
          <UiInput
            v-model="redis.port as unknown as string"
            type="number"
          />
        </div>
        <div class="space-y-1.5">
          <UiLabel>{{ t('mail.password') }}</UiLabel>
          <UiInput
            v-model="redis.password"
            type="password"
            autocomplete="new-password"
          />
        </div>
      </div>
      <div class="mt-3">
        <UiButton
          type="button"
          variant="outline"
          size="sm"
          :disabled="!canEdit"
          @click="test('cache')"
        >
          <PlugZapIcon /> {{ t('db.testCache') }}
        </UiButton>
      </div>
    </div>

    <div
      v-if="canEdit"
      class="rounded-xl border border-destructive/30 bg-destructive/5 p-4"
    >
      <div class="flex items-start gap-3">
        <Trash2Icon class="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
        <div class="min-w-0 flex-1">
          <h3 class="text-sm font-semibold">
            {{ t('db.cleanupTitle') }}
          </h3>
          <p class="mt-1 text-xs text-muted-foreground">
            {{ t('db.cleanupDescription') }}
          </p>
          <p
            v-if="cleanupCounts"
            class="mt-2 text-xs text-muted-foreground"
          >
            {{ t('db.cleanupCounts', cleanupCounts) }}
          </p>
          <UiButton
            type="button"
            variant="destructive"
            size="sm"
            class="mt-3"
            :disabled="cleaning || !cleanupCounts"
            @click="cleanup"
          >
            <Trash2Icon /> {{ cleaning ? t('db.cleanupRunning') : t('db.cleanupAction') }}
          </UiButton>
        </div>
      </div>
    </div>

    <p
      v-if="result"
      class="text-xs"
      :class="result.ok ? 'text-[var(--success)]' : 'text-destructive'"
    >
      {{ result.message }}
    </p>

    <div class="flex items-center justify-between gap-3 border-t pt-4">
      <span
        v-if="restartNeeded"
        class="flex items-center gap-1.5 text-xs text-[var(--warning)]"
      >
        <CheckCircle2Icon class="h-3.5 w-3.5" /> {{ t('db.restartNeeded') }}
      </span>
      <UiButton
        v-if="canEdit"
        type="submit"
        :disabled="saving"
        class="ml-auto"
      >
        <SendIcon /> {{ saving ? t('common.saving') : t('common.saveChanges') }}
      </UiButton>
    </div>
  </form>
</template>
