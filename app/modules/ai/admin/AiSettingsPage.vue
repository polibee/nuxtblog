<script setup lang="ts">
import { useI18n } from '~/admin/i18n'
import { notify, notifyError } from '~/admin/notifications/notify'

/* AI settings (AI 集成文档 §118/122): provider config + connection
   test + recent usage. API keys are AES-256-GCM encrypted at rest and
   only ever shown masked. */

defineProps<{ resource: { name: string } }>()

const { t } = useI18n()

const providers = ref<AiProvider[]>([])
const requests = ref<AiRequest[]>([])
const loading = ref(false)
const saving = ref(false)
const testing = ref(false)
const error = ref('')
const testResult = ref('')

type ProviderType = 'openai' | 'openai_compatible' | 'anthropic'

interface AiProvider {
  id: number
  name: string
  providerType: ProviderType
  baseUrl: string
  apiKeyHint: string
  hasKey: boolean
  defaultModel: string
  enabled: boolean
}

interface AiRequest {
  id: number
  feature: string
  model: string
  status: string
  inputTokens: number | null
  outputTokens: number | null
  latencyMs: number | null
  errorCode: string | null
  cacheStatus?: string
  savedTokens?: number | null
  createdAt: string
}

const form = ref({
  id: null as number | null,
  name: 'OpenAI',
  providerType: 'openai_compatible' as ProviderType,
  baseUrl: 'https://api.openai.com/v1',
  apiKey: '',
  defaultModel: 'gpt-4o-mini',
  enabled: true
})

const typeDefaults: Record<string, string> = {
  openai: 'https://api.openai.com/v1',
  openai_compatible: '',
  anthropic: 'https://api.anthropic.com'
}

function editProvider(provider: AiProvider): void {
  form.value = {
    id: provider.id,
    name: provider.name,
    providerType: provider.providerType,
    baseUrl: provider.baseUrl,
    apiKey: '',
    defaultModel: provider.defaultModel,
    enabled: provider.enabled
  }
}

function newProvider(): void {
  form.value = {
    id: null,
    name: '',
    providerType: 'openai_compatible',
    baseUrl: '',
    apiKey: '',
    defaultModel: '',
    enabled: true
  }
}

function onTypeChange(): void {
  if (!form.value.baseUrl || Object.values(typeDefaults).includes(form.value.baseUrl)) {
    form.value.baseUrl = typeDefaults[form.value.providerType] ?? ''
  }
}

async function load(): Promise<void> {
  loading.value = true
  try {
    const [providerRes, usageRes] = await Promise.all([
      $fetch<{ providers: AiProvider[] }>('/api/admin/ai/settings'),
      $fetch<{ requests: AiRequest[] }>('/api/admin/ai/requests')
    ])
    providers.value = providerRes.providers
    requests.value = usageRes.requests
    if (providers.value.length > 0 && !form.value.id) {
      editProvider(providers.value[0]!)
    }
    error.value = ''
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    loading.value = false
  }
}

async function save(): Promise<void> {
  saving.value = true
  try {
    const res = await $fetch<{ provider: AiProvider }>('/api/admin/ai/settings', {
      method: 'POST',
      body: form.value
    })
    notify(t('res.ai.saved'))
    await load()
    editProvider(res.provider)
  } catch (e) {
    notifyError(t('res.ai.saveFailed'), (e as Error).message)
  } finally {
    saving.value = false
  }
}

async function testConnection(): Promise<void> {
  testing.value = true
  testResult.value = ''
  try {
    const res = await $fetch<{ latencyMs: number, model: string }>('/api/admin/ai/settings/test', { method: 'POST' })
    testResult.value = t('res.ai.testOk', { model: res.model, ms: res.latencyMs })
    notify(t('res.ai.testOk', { model: res.model, ms: res.latencyMs }))
  } catch (e) {
    testResult.value = t('res.ai.testFailed', { msg: (e as Error).message })
  } finally {
    testing.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <h1 class="text-2xl font-semibold tracking-tight">
        {{ t('res.ai.label') }}
      </h1>
    </div>

    <p
      v-if="error"
      class="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive"
    >
      {{ error }}
    </p>

    <!-- provider form -->
    <div class="rounded-xl border p-5">
      <div class="mb-3 flex items-center justify-between">
        <h2 class="text-sm font-semibold">
          {{ t('res.ai.provider') }}
        </h2>
        <UiButton
          size="sm"
          variant="outline"
          @click="newProvider"
        >
          {{ t('res.ai.newProvider') }}
        </UiButton>
      </div>

      <div class="grid gap-4 sm:grid-cols-2">
        <label class="block space-y-1 text-sm">
          <span class="text-muted-foreground">{{ t('res.ai.name') }} *</span>
          <input
            v-model="form.name"
            maxlength="80"
            class="h-9 w-full rounded-md border bg-background px-3 text-sm"
          >
        </label>
        <label class="block space-y-1 text-sm">
          <span class="text-muted-foreground">{{ t('res.ai.type') }}</span>
          <select
            v-model="form.providerType"
            class="h-9 w-full rounded-md border bg-background px-2 text-sm"
            @change="onTypeChange"
          >
            <option value="openai">
              OpenAI
            </option>
            <option value="openai_compatible">
              {{ t('res.ai.typeCompatible') }}
            </option>
            <option value="anthropic">
              Anthropic
            </option>
          </select>
        </label>
        <label class="block space-y-1 text-sm sm:col-span-2">
          <span class="text-muted-foreground">{{ t('res.ai.baseUrl') }} *</span>
          <input
            v-model="form.baseUrl"
            class="h-9 w-full rounded-md border bg-background px-3 text-sm"
            placeholder="https://api.openai.com/v1"
          >
        </label>
        <label class="block space-y-1 text-sm">
          <span class="text-muted-foreground">
            {{ t('res.ai.apiKey') }}
            <span
              v-if="form.id"
              class="ml-1 text-[10px]"
            >{{ t('res.ai.apiKeyKeep') }}</span>
          </span>
          <input
            v-model="form.apiKey"
            type="password"
            autocomplete="off"
            class="h-9 w-full rounded-md border bg-background px-3 text-sm"
          >
        </label>
        <label class="block space-y-1 text-sm">
          <span class="text-muted-foreground">{{ t('res.ai.model') }} *</span>
          <input
            v-model="form.defaultModel"
            class="h-9 w-full rounded-md border bg-background px-3 text-sm"
            placeholder="gpt-4o-mini"
          >
        </label>
      </div>

      <div class="mt-4 flex flex-wrap items-center gap-3">
        <label class="flex items-center gap-2 text-sm text-muted-foreground">
          {{ t('res.sidebar.authorcard.enabled') }}
          <UiSwitch
            :model-value="form.enabled"
            @update:model-value="form.enabled = $event as boolean"
          />
        </label>
        <UiButton
          :disabled="saving"
          @click="save"
        >
          {{ saving ? t('common.saving') : t('common.save') }}
        </UiButton>
        <UiButton
          variant="outline"
          :disabled="testing || saving"
          @click="testConnection"
        >
          {{ t('res.ai.test') }}
        </UiButton>
        <span
          v-if="testResult"
          class="text-xs"
          :class="testResult.includes('Failed') || testResult.includes('AI_') ? 'text-destructive' : 'text-[var(--success)]'"
        >
          {{ testResult }}
        </span>
      </div>
    </div>

    <!-- providers list -->
    <div class="overflow-x-auto rounded-xl border">
      <table class="w-full text-sm">
        <thead class="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th class="px-4 py-3">
              {{ t('res.ai.name') }}
            </th>
            <th class="px-4 py-3">
              {{ t('res.ai.type') }}
            </th>
            <th class="px-4 py-3">
              {{ t('res.ai.model') }}
            </th>
            <th class="px-4 py-3">
              {{ t('res.ai.apiKey') }}
            </th>
            <th class="px-4 py-3 text-right">
              {{ t('res.adcampaigns.actions') }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="provider in providers"
            :key="provider.id"
            class="border-t transition-colors hover:bg-accent/30"
          >
            <td class="px-4 py-3 font-medium">
              {{ provider.name }}
              <span
                v-if="provider.enabled"
                class="ml-1.5 rounded bg-[var(--success)]/15 px-1.5 py-0.5 text-[10px] text-[var(--success)]"
              >{{ t('res.ai.enabled') }}</span>
            </td>
            <td class="px-4 py-3 text-xs text-muted-foreground">
              {{ provider.providerType }}
            </td>
            <td class="px-4 py-3 text-xs text-muted-foreground">
              {{ provider.defaultModel }}
            </td>
            <td class="px-4 py-3 font-mono text-xs text-muted-foreground">
              {{ provider.apiKeyHint || '—' }}
            </td>
            <td class="px-4 py-3 text-right">
              <button
                type="button"
                class="h-8 rounded-md border px-3 text-xs hover:bg-accent"
                @click="editProvider(provider)"
              >
                {{ t('common.edit') }}
              </button>
            </td>
          </tr>
          <tr v-if="providers.length === 0">
            <td
              colspan="5"
              class="px-4 py-10 text-center text-muted-foreground"
            >
              {{ t('res.ai.noProvider') }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- recent usage -->
    <div class="rounded-xl border p-5">
      <h2 class="mb-3 text-sm font-semibold">
        {{ t('res.ai.usage') }}
      </h2>
      <p
        v-if="requests.length === 0"
        class="text-xs text-muted-foreground"
      >
        {{ t('res.ai.noUsage') }}
      </p>
      <ul class="space-y-1 text-xs text-muted-foreground">
        <li
          v-for="request in requests"
          :key="request.id"
          class="flex flex-wrap justify-between gap-2 border-b py-1 last:border-b-0"
        >
          <span class="font-medium text-foreground">{{ request.feature }}</span>
          <span>
            {{ request.status }} · {{ request.model }}
            <template v-if="request.inputTokens">
              · {{ request.inputTokens }}/{{ request.outputTokens ?? 0 }} tok
            </template>
            <template v-if="request.cacheStatus && request.cacheStatus !== 'MISS'">
              · <span class="font-medium text-primary">{{ request.cacheStatus }} −{{ request.savedTokens ?? 0 }} tok</span>
            </template>
            <template v-if="request.latencyMs">
              · {{ request.latencyMs }}ms
            </template>
            <template v-if="request.errorCode">
              · {{ request.errorCode }}
            </template>
          </span>
        </li>
      </ul>
    </div>
  </div>
</template>
