<script setup lang="ts">
import { useI18n } from '~/admin/i18n'

interface ProviderFieldTemplate {
  key: string
  label: string
  required: boolean
  secret: boolean
  placeholder?: string
  help?: string
}

interface ProviderTemplate {
  providerKey: string
  name: string
  description: string
  capabilities: string[]
  fields: ProviderFieldTemplate[]
  docsUrl?: string
  signupUrl?: string
}

interface GatewayInstance {
  id: number
  key: string
  providerKey: string
  displayName: string
  enabled: boolean
  mode: string
  sortOrder: number
  enabledCurrencies: string | null
  config: Record<string, string> | null
  hasConfig: boolean
}

const { t } = useI18n()

/* plain fetcher bypassing Nuxt typed-routes matching for dynamic URLs */
const rawFetch = $fetch as unknown as (url: string, opts?: Record<string, unknown>) => Promise<unknown>

const gateways = ref<GatewayInstance[]>([])
const providers = ref<ProviderTemplate[]>([])
const loading = ref(true)
const error = ref('')

const dialogOpen = ref(false)
const editingId = ref<number | null>(null)
const saving = ref(false)
const testingId = ref<number | null>(null)
const testResult = ref<Record<number, { ok: boolean, message: string }>>({})

const form = reactive({
  providerKey: '',
  key: '',
  displayName: '',
  mode: 'sandbox',
  enabled: false,
  sortOrder: 0,
  enabledCurrencies: '',
  config: {} as Record<string, string>
})

const selectedTemplate = computed(() =>
  providers.value.find(p => p.providerKey === form.providerKey)
)

async function load(): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    const [gw, pv] = await Promise.all([
      $fetch<GatewayInstance[]>('/api/admin/payment-gateways'),
      $fetch<{ providers: ProviderTemplate[] }>('/api/admin/payment-gateways/providers')
    ])
    gateways.value = gw
    providers.value = pv.providers
  } catch (e) {
    error.value = (e as Error).message || t('res.paygw.saveFailed')
  } finally {
    loading.value = false
  }
}

onMounted(load)

function openCreate(): void {
  editingId.value = null
  form.providerKey = ''
  form.key = ''
  form.displayName = ''
  form.mode = 'sandbox'
  form.enabled = false
  form.sortOrder = gateways.value.length + 1
  form.enabledCurrencies = ''
  form.config = {}
  dialogOpen.value = true
}

function openEdit(gateway: GatewayInstance): void {
  editingId.value = gateway.id
  form.providerKey = gateway.providerKey
  form.key = gateway.key
  form.displayName = gateway.displayName
  form.mode = gateway.mode
  form.enabled = gateway.enabled
  form.sortOrder = gateway.sortOrder
  form.enabledCurrencies = gateway.enabledCurrencies ?? ''
  form.config = {}
  dialogOpen.value = true
}

function onProviderChange(): void {
  const sameProviderCount = gateways.value.filter(g => g.providerKey === form.providerKey).length
  form.key = sameProviderCount > 0 ? `${form.providerKey}-${sameProviderCount + 1}` : form.providerKey
  form.displayName = selectedTemplate.value?.name ?? ''
  form.config = {}
}

async function save(): Promise<void> {
  saving.value = true
  error.value = ''
  try {
    const payload = {
      key: form.key.trim(),
      providerKey: form.providerKey,
      displayName: form.displayName.trim() || form.key.trim(),
      enabled: form.enabled,
      mode: form.mode,
      sortOrder: Number(form.sortOrder) || 0,
      enabledCurrencies: form.enabledCurrencies.trim() || null,
      config: Object.keys(form.config).length > 0 ? form.config : (editingId.value === null ? {} : undefined)
    }
    if (editingId.value === null) {
      await $fetch('/api/admin/payment-gateways', { method: 'POST', body: payload })
    } else {
      const body: Record<string, unknown> = {
        displayName: payload.displayName,
        enabled: payload.enabled,
        mode: payload.mode,
        sortOrder: payload.sortOrder,
        enabledCurrencies: payload.enabledCurrencies
      }
      if (payload.config !== undefined) body.config = payload.config
      const putUrl: string = `/api/admin/payment-gateways/${editingId.value}`
      await rawFetch(putUrl, { method: 'PUT', body })
    }
    dialogOpen.value = false
    await load()
  } catch (e) {
    error.value = (e as Error).message || t('res.paygw.saveFailed')
  } finally {
    saving.value = false
  }
}

async function toggleEnabled(gateway: GatewayInstance): Promise<void> {
  error.value = ''
  testResult.value[gateway.id] = { ok: true, message: '' }
  try {
    const toggleUrl: string = `/api/admin/payment-gateways/${gateway.id}`
    await rawFetch(toggleUrl, {
      method: 'PUT',
      body: { enabled: !gateway.enabled }
    })
    await load()
  } catch (e) {
    error.value = (e as Error).message || t('res.paygw.saveFailed')
    testResult.value[gateway.id] = { ok: false, message: error.value }
  }
}

async function testGateway(gateway: GatewayInstance): Promise<void> {
  testingId.value = gateway.id
  try {
    const url: string = `/api/admin/payment-gateways/${gateway.id}/test`
    testResult.value[gateway.id] = await rawFetch(url, { method: 'POST' }) as { ok: boolean, message: string }
  } catch (e) {
    testResult.value[gateway.id] = { ok: false, message: (e as Error).message || t('res.paygw.saveFailed') }
  } finally {
    testingId.value = null
  }
}

async function removeGateway(gateway: GatewayInstance): Promise<void> {
  if (!confirm(t('res.paygw.deleteConfirm'))) return
  try {
    const deleteUrl: string = `/api/admin/payment-gateways/${gateway.id}`
    await rawFetch(deleteUrl, { method: 'DELETE' })
    await load()
  } catch (e) {
    error.value = (e as Error).message || t('res.paygw.saveFailed')
  }
}

function providerName(providerKey: string): string {
  return providers.value.find(p => p.providerKey === providerKey)?.name ?? providerKey
}

function providerSignup(providerKey: string): string | undefined {
  return providers.value.find(p => p.providerKey === providerKey)?.signupUrl
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight">
          {{ t('res.paygw.title') }}
        </h1>
        <p class="mt-1 text-sm text-muted-foreground">
          {{ t('res.paygw.description') }}
        </p>
      </div>
      <button
        type="button"
        class="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        @click="openCreate"
      >
        {{ t('res.paygw.add') }}
      </button>
    </div>

    <p
      v-if="error"
      class="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive"
    >
      {{ error }}
    </p>

    <div
      v-if="loading"
      class="py-10 text-center text-sm text-muted-foreground"
    >
      {{ t('common.loading') }}
    </div>

    <div
      v-else-if="gateways.length === 0"
      class="rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground"
    >
      {{ t('res.paygw.none') }}
    </div>

    <div
      v-else
      class="grid gap-4"
    >
      <div
        v-for="gateway in gateways"
        :key="gateway.id"
        class="rounded-lg border bg-card p-4"
      >
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div class="flex items-center gap-3">
            <span
              class="inline-flex h-2.5 w-2.5 rounded-full"
              :class="gateway.enabled ? 'bg-emerald-500' : 'bg-muted-foreground/40'"
            />
            <div>
              <div class="flex items-center gap-2 text-sm font-medium">
                {{ gateway.displayName }}
                <span class="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">{{ providerName(gateway.providerKey) }}</span>
                <span
                  class="rounded px-1.5 py-0.5 text-xs"
                  :class="gateway.mode === 'live' ? 'bg-destructive/15 text-destructive' : 'bg-muted text-muted-foreground'"
                >{{ gateway.mode === 'live' ? t('res.paygw.mode.live') : t('res.paygw.mode.sandbox') }}</span>
              </div>
              <div class="mt-1 text-xs text-muted-foreground">
                {{ gateway.key }} · {{ t('res.paygw.sort') }} {{ gateway.sortOrder }} ·
                {{ t('res.paygw.currencies') }}: {{ gateway.enabledCurrencies || '—' }}
              </div>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <button
              type="button"
              class="h-8 rounded-md border px-3 text-xs hover:bg-accent"
              :disabled="testingId === gateway.id"
              @click="testGateway(gateway)"
            >
              {{ testingId === gateway.id ? t('res.paygw.testing') : t('res.paygw.test') }}
            </button>
            <a
              v-if="providerSignup(gateway.providerKey)"
              :href="providerSignup(gateway.providerKey)"
              target="_blank"
              rel="noopener noreferrer"
              class="h-8 rounded-md border px-3 text-xs leading-8 text-primary hover:bg-accent"
            >
              {{ t('res.paygw.signup') }} ↗
            </a>
            <button
              type="button"
              class="h-8 rounded-md border px-3 text-xs hover:bg-accent"
              @click="openEdit(gateway)"
            >
              {{ t('res.paygw.edit') }}
            </button>
            <button
              type="button"
              class="h-8 rounded-md border border-destructive/40 px-3 text-xs text-destructive hover:bg-destructive/10"
              @click="removeGateway(gateway)"
            >
              {{ t('res.paygw.delete') }}
            </button>
            <button
              type="button"
              class="relative h-6 w-11 rounded-full transition-colors"
              :class="gateway.enabled ? 'bg-emerald-500' : 'bg-muted-foreground/30'"
              :title="gateway.enabled ? t('res.paygw.enabled') : t('res.paygw.disabled')"
              @click="toggleEnabled(gateway)"
            >
              <span
                class="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all"
                :class="gateway.enabled ? 'left-[22px]' : 'left-0.5'"
              />
            </button>
          </div>
        </div>
        <p
          v-if="testResult[gateway.id]?.message"
          class="mt-2 text-xs"
          :class="testResult[gateway.id]?.ok ? 'text-emerald-600' : 'text-destructive'"
        >
          {{ testResult[gateway.id]?.message }}
        </p>
      </div>
    </div>

    <div
      v-if="dialogOpen"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    >
      <div class="max-h-[85vh] w-full max-w-xl overflow-y-auto rounded-lg border bg-background p-5 shadow-lg">
        <h2 class="mb-4 text-lg font-semibold">
          {{ editingId === null ? t('res.paygw.add') : t('res.paygw.edit') }}
        </h2>

        <div class="space-y-4">
          <div v-if="editingId === null">
            <label class="mb-1 block text-sm font-medium">{{ t('res.paygw.provider') }}</label>
            <select
              v-model="form.providerKey"
              class="h-9 w-full rounded-md border bg-background px-2 text-sm"
              @change="onProviderChange"
            >
              <option
                value=""
                disabled
              >
                —
              </option>
              <option
                v-for="provider in providers"
                :key="provider.providerKey"
                :value="provider.providerKey"
              >
                {{ provider.name }}
              </option>
            </select>
            <p
              v-if="selectedTemplate"
              class="mt-1 text-xs text-muted-foreground"
            >
              {{ selectedTemplate.description }}
            </p>
            <p
              v-if="selectedTemplate?.signupUrl"
              class="mt-1 text-xs"
            >
              <a
                :href="selectedTemplate.signupUrl"
                target="_blank"
                rel="noopener noreferrer"
                class="text-primary hover:underline"
              >
                {{ t('res.paygw.signup') }} ↗
              </a>
            </p>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="mb-1 block text-sm font-medium">{{ t('res.paygw.key') }}</label>
              <input
                v-model="form.key"
                :disabled="editingId !== null"
                class="h-9 w-full rounded-md border bg-background px-2 text-sm disabled:opacity-60"
              >
            </div>
            <div>
              <label class="mb-1 block text-sm font-medium">{{ t('res.paygw.displayName') }}</label>
              <input
                v-model="form.displayName"
                class="h-9 w-full rounded-md border bg-background px-2 text-sm"
              >
            </div>
            <div>
              <label class="mb-1 block text-sm font-medium">{{ t('res.paygw.mode') }}</label>
              <select
                v-model="form.mode"
                class="h-9 w-full rounded-md border bg-background px-2 text-sm"
              >
                <option value="sandbox">
                  {{ t('res.paygw.mode.sandbox') }}
                </option>
                <option value="live">
                  {{ t('res.paygw.mode.live') }}
                </option>
              </select>
            </div>
            <div>
              <label class="mb-1 block text-sm font-medium">{{ t('res.paygw.sort') }}</label>
              <input
                v-model.number="form.sortOrder"
                type="number"
                class="h-9 w-full rounded-md border bg-background px-2 text-sm"
              >
            </div>
            <div class="col-span-2">
              <label class="mb-1 block text-sm font-medium">{{ t('res.paygw.currencies') }}</label>
              <input
                v-model="form.enabledCurrencies"
                class="h-9 w-full rounded-md border bg-background px-2 text-sm"
                :placeholder="t('res.paygw.currenciesHint')"
              >
            </div>
          </div>

          <div v-if="selectedTemplate && selectedTemplate.fields.length > 0">
            <label class="mb-2 block text-sm font-medium">{{ t('res.paygw.config') }}</label>
            <div class="space-y-3">
              <div
                v-for="field in selectedTemplate.fields"
                :key="field.key"
              >
                <label class="mb-1 block text-sm">
                  {{ field.label }}<span
                    v-if="field.required"
                    class="text-destructive"
                  > *</span>
                </label>
                <input
                  v-model="form.config[field.key]"
                  :type="field.secret ? 'password' : 'text'"
                  :placeholder="field.placeholder"
                  autocomplete="off"
                  class="h-9 w-full rounded-md border bg-background px-2 text-sm"
                >
                <p
                  v-if="field.help"
                  class="mt-1 text-xs text-muted-foreground"
                >
                  {{ field.help }}
                </p>
              </div>
              <p
                v-if="editingId !== null"
                class="text-xs text-muted-foreground"
              >
                {{ t('res.paygw.configHint') }}
              </p>
            </div>
          </div>

          <label class="flex items-center gap-2 text-sm">
            <input
              v-model="form.enabled"
              type="checkbox"
              class="h-4 w-4"
            >
            {{ t('res.paygw.enabled') }}
          </label>
        </div>

        <div class="mt-5 flex justify-end gap-2">
          <button
            type="button"
            class="h-9 rounded-md border px-4 text-sm hover:bg-accent"
            @click="dialogOpen = false"
          >
            {{ t('common.cancel') }}
          </button>
          <button
            type="button"
            :disabled="saving || (editingId === null && !form.providerKey)"
            class="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            @click="save"
          >
            {{ saving ? t('common.saving') : t('common.save') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
