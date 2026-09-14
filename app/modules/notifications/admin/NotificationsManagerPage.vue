<script setup lang="ts">
import { channelDeleteErrorMessage, channelDeleteMessage } from '#shared/utils/notification-channel'
import { useI18n } from '~/admin/i18n'
import { resolveAdminDisplayLabel } from '~/admin/i18n/display-label'
import { notify, notifyError } from '~/admin/notifications/notify'
import { PlusIcon, PencilIcon, Trash2Icon, SendIcon, SearchIcon } from 'lucide-vue-next'

/* P38 Notifications manager (docs/webhook.txt §76/82): Channels,
   Subscriptions (EventPicker) and Delivery Logs in one workspace. */

defineProps<{ resource: { name: string } }>()

const { t, locale } = useI18n()

interface Channel { id: number, name: string, provider: string, configHint: string, enabled: boolean }
interface Subscription { id: number, name: string, enabled: boolean, minimumSeverity: string | null, channel: { id: number, name: string, provider: string } | null, events: string[] }
interface EventDef { name: string, module: string, label: { zh: string, en: string }, severity: string }
interface Delivery { id: number, provider: string, channelName: string | null, status: string, attemptCount: number, responseSummary: string | null, lastError: string | null, createdAt: string, sentAt: string | null }

const tab = ref<'channels' | 'subscriptions' | 'logs'>('channels')
const channels = ref<Channel[]>([])
const subscriptions = ref<Subscription[]>([])
const deliveries = ref<Delivery[]>([])
const loading = ref(false)

const PROVIDERS = ['webhook', 'lark', 'spug'] as const
const SEVERITIES = ['info', 'warning', 'error', 'critical'] as const

/* channel editor */
const channelOpen = ref(false)
const channelForm = reactive({ id: null as number | null, name: '', provider: 'webhook' as string, url: '', secret: '', enabled: true })

/* subscription editor */
const subOpen = ref(false)
const subForm = reactive({
  id: null as number | null,
  name: '',
  channelId: null as number | null,
  enabled: true,
  minimumSeverity: '' as string,
  events: [] as string[]
})
const eventSearch = ref('')
const eventDefs = ref<EventDef[]>([])
const eventModules = ref<Array<{ id: string, label: { zh: string, en: string } }>>([])

async function load(): Promise<void> {
  loading.value = true
  try {
    const [ch, subs, dels] = await Promise.all([
      $fetch<{ items: Channel[] }>('/api/admin/notifications/channels'),
      $fetch<{ items: Subscription[] }>('/api/admin/notifications/subscriptions'),
      $fetch<{ items: Delivery[] }>('/api/admin/notifications/deliveries')
    ])
    channels.value = ch.items ?? []
    subscriptions.value = subs.items ?? []
    deliveries.value = dels.items ?? []
  } finally {
    loading.value = false
  }
}

async function loadEvents(): Promise<void> {
  try {
    const res = await $fetch<{ events: EventDef[], modules: Array<{ id: string, label: { zh: string, en: string } }> }>(
      '/api/admin/notifications/events',
      { query: eventSearch.value.trim() ? { search: eventSearch.value.trim() } : undefined }
    )
    eventDefs.value = res.events ?? []
    eventModules.value = res.modules ?? []
  } catch { /* picker stays empty */ }
}

watch(eventSearch, () => void loadEvents())
watch(tab, () => {
  if (tab.value === 'subscriptions' && eventDefs.value.length === 0) void loadEvents()
})

function openChannel(channel?: Channel): void {
  channelOpen.value = true
  channelForm.id = channel?.id ?? null
  channelForm.name = channel?.name ?? ''
  channelForm.provider = channel?.provider ?? 'webhook'
  channelForm.url = ''
  channelForm.secret = ''
  channelForm.enabled = channel?.enabled ?? true
}

async function saveChannel(): Promise<void> {
  if (!channelForm.name.trim() || !channelForm.url.trim()) {
    notifyError(t('res.notifications.saveFailed'), t('res.notifications.requiredFields'))
    return
  }
  try {
    if (channelForm.id) {
      await $fetch(`/api/admin/notifications/channels/${channelForm.id}`, {
        method: 'PATCH',
        body: { name: channelForm.name, enabled: channelForm.enabled, config: { url: channelForm.url, secret: channelForm.secret || undefined } }
      })
    } else {
      await $fetch('/api/admin/notifications/channels', {
        method: 'POST',
        body: { name: channelForm.name, provider: channelForm.provider, config: { url: channelForm.url, secret: channelForm.secret || undefined } }
      })
    }
    notify(t('res.notifications.saved'))
    channelOpen.value = false
    await load()
  } catch (e) {
    notifyError(t('res.notifications.saveFailed'), (e as Error).message)
  }
}

async function testChannel(channel: Channel): Promise<void> {
  try {
    const res = await $fetch<{ ok: boolean, summary: string }>(`/api/admin/notifications/channels/${channel.id}/test`, { method: 'POST' })
    if (res.ok) notify(t('res.notifications.testOk'))
    else notifyError(t('res.notifications.testFailed'), res.summary)
  } catch (e) {
    notifyError(t('res.notifications.testFailed'), (e as Error).message)
  }
}

async function toggleChannel(channel: Channel): Promise<void> {
  await $fetch(`/api/admin/notifications/channels/${channel.id}`, { method: 'PATCH', body: { enabled: !channel.enabled } })
  await load()
}

async function deleteChannel(channel: Channel): Promise<void> {
  if (!window.confirm(t('res.notifications.channelDeleteConfirm'))) return
  try {
    const result = await $fetch<{ ok: boolean, action: 'deleted' | 'disabled' }>(`/api/admin/notifications/channels/${channel.id}`, { method: 'DELETE' })
    notify(channelDeleteMessage(result.action))
    await load()
  } catch (e) {
    const error = e as { statusCode?: number, statusMessage?: string, message?: string, data?: { statusMessage?: string } }
    notifyError(t('res.notifications.deleteFailed'), channelDeleteErrorMessage(error.statusCode, error.data?.statusMessage ?? error.statusMessage ?? error.message ?? ''))
  }
}

function openSubscription(sub?: Subscription): void {
  subOpen.value = true
  subForm.id = sub?.id ?? null
  subForm.name = sub?.name ?? ''
  subForm.channelId = sub?.channel?.id ?? channels.value[0]?.id ?? null
  subForm.enabled = sub?.enabled ?? true
  subForm.minimumSeverity = sub?.minimumSeverity ?? ''
  subForm.events = [...(sub?.events ?? [])]
  if (eventDefs.value.length === 0) void loadEvents()
}

function toggleEvent(name: string): void {
  const i = subForm.events.indexOf(name)
  if (i >= 0) subForm.events.splice(i, 1)
  else subForm.events.push(name)
}

async function saveSubscription(): Promise<void> {
  if (!subForm.name.trim() || !subForm.channelId || subForm.events.length === 0) {
    notifyError(t('res.notifications.saveFailed'), t('res.notifications.requiredFields'))
    return
  }
  try {
    if (subForm.id) {
      await $fetch(`/api/admin/notifications/subscriptions/${subForm.id}`, {
        method: 'PATCH',
        body: { name: subForm.name, enabled: subForm.enabled, minimumSeverity: subForm.minimumSeverity || null, events: subForm.events }
      })
    } else {
      await $fetch('/api/admin/notifications/subscriptions', {
        method: 'POST',
        body: { name: subForm.name, channelId: subForm.channelId, enabled: subForm.enabled, minimumSeverity: subForm.minimumSeverity || null, events: subForm.events }
      })
    }
    notify(t('res.notifications.saved'))
    subOpen.value = false
    await load()
  } catch (e) {
    notifyError(t('res.notifications.saveFailed'), (e as Error).message)
  }
}

async function deleteSubscription(sub: Subscription): Promise<void> {
  if (!window.confirm(t('res.notifications.deleteConfirm'))) return
  await $fetch(`/api/admin/notifications/subscriptions/${sub.id}`, { method: 'DELETE' })
  await load()
}

async function retryDelivery(delivery: Delivery): Promise<void> {
  try {
    await $fetch(`/api/admin/notifications/deliveries/${delivery.id}/retry`, { method: 'POST' })
    notify(t('res.notifications.retryDone'))
    await load()
  } catch (e) {
    notifyError(t('res.notifications.saveFailed'), (e as Error).message)
  }
}

function label(value: { zh: string, en: string }): string {
  return locale.value === 'en' ? value.en : value.zh
}

const eventGroups = computed(() => {
  const term = eventSearch.value.trim().toLowerCase()
  return eventModules.value.map((module) => {
    const all = eventDefs.value.filter(e => e.module === module.id)
    const events = term
      ? all.filter(e =>
          e.name.toLowerCase().includes(term)
          || e.label.zh.toLowerCase().includes(term)
          || e.label.en.toLowerCase().includes(term)
        )
      : all
    return {
      id: module.id,
      label: module.label,
      events,
      enabledCount: events.filter(e => subForm.events.includes(e.name)).length
    }
  }).filter(g => g.events.length > 0)
})

function setGroup(moduleId: string, select: boolean): void {
  const names = eventDefs.value.filter(e => e.module === moduleId).map(e => e.name)
  for (const name of names) {
    const i = subForm.events.indexOf(name)
    if (select && i < 0) subForm.events.push(name)
    if (!select && i >= 0) subForm.events.splice(i, 1)
  }
}

function statusClass(status: string): string {
  if (status === 'success') return 'text-primary'
  if (status === 'failed' || status === 'dead') return 'text-destructive'
  return 'text-muted-foreground'
}

onMounted(load)
</script>

<template>
  <div class="space-y-5">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div class="flex gap-1 rounded-lg border p-1 text-sm">
        <button
          v-for="name in ['channels', 'subscriptions', 'logs']"
          :key="name"
          type="button"
          class="rounded-md px-3 py-1.5"
          :class="tab === name ? 'bg-accent font-medium' : 'text-muted-foreground'"
          @click="tab = name as typeof tab"
        >
          {{ resolveAdminDisplayLabel(t, 'notificationTab', name) }}
          <span
            v-if="name === 'channels'"
            class="ml-1 text-xs text-muted-foreground"
          >{{ channels.length }}</span>
          <span
            v-else-if="name === 'subscriptions'"
            class="ml-1 text-xs text-muted-foreground"
          >{{ subscriptions.length }}</span>
        </button>
      </div>
      <UiButton
        v-if="tab === 'channels'"
        @click="openChannel()"
      >
        <PlusIcon class="mr-1 h-4 w-4" />{{ t('res.notifications.addChannel') }}
      </UiButton>
      <UiButton
        v-else-if="tab === 'subscriptions'"
        :disabled="channels.length === 0"
        @click="openSubscription()"
      >
        <PlusIcon class="mr-1 h-4 w-4" />{{ t('res.notifications.addSubscription') }}
      </UiButton>
    </div>

    <p
      v-if="channels.length === 0 && tab !== 'channels'"
      class="rounded-xl border p-4 text-sm text-muted-foreground"
    >
      {{ t('res.notifications.needChannelFirst') }}
    </p>

    <!-- channels -->
    <div
      v-if="tab === 'channels'"
      class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
    >
      <div
        v-for="channel in channels"
        :key="channel.id"
        class="space-y-2 rounded-xl border p-4"
      >
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0">
            <p class="font-medium">
              {{ channel.name }}
              <span class="ml-1 rounded-md bg-muted px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">{{ channel.provider }}</span>
            </p>
            <p class="truncate text-xs text-muted-foreground">
              {{ channel.configHint }}
            </p>
          </div>
          <span
            class="shrink-0 rounded-full px-2 py-0.5 text-[10px]"
            :class="channel.enabled ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'"
          >{{ channel.enabled ? t('res.notifications.on') : t('res.notifications.off') }}</span>
        </div>
        <div class="flex justify-end gap-1">
          <UiButton
            size="sm"
            variant="outline"
            @click="testChannel(channel)"
          >
            <SendIcon class="mr-1 h-3 w-3" />{{ t('res.notifications.test') }}
          </UiButton>
          <button
            type="button"
            class="h-8 w-8 rounded-md border hover:bg-accent"
            :title="t('common.edit')"
            @click="openChannel(channel)"
          >
            <PencilIcon class="mx-auto h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            class="h-8 w-8 rounded-md border hover:bg-accent"
            :title="channel.enabled ? t('res.notifications.disable') : t('res.notifications.enable')"
            @click="toggleChannel(channel)"
          >
            <span class="text-xs">{{ channel.enabled ? '⏸' : '▶' }}</span>
          </button>
          <button
            type="button"
            class="h-8 w-8 rounded-md border border-destructive/40 text-destructive hover:bg-destructive/10"
            :title="t('common.delete')"
            @click="deleteChannel(channel)"
          >
            <Trash2Icon class="mx-auto h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <p
        v-if="channels.length === 0"
        class="col-span-full rounded-xl border p-10 text-center text-muted-foreground"
      >
        {{ t('res.notifications.noChannels') }}
      </p>
    </div>

    <!-- subscriptions -->
    <div
      v-if="tab === 'subscriptions'"
      class="space-y-3"
    >
      <div
        v-for="sub in subscriptions"
        :key="sub.id"
        class="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4"
      >
        <div class="min-w-0">
          <p class="font-medium">
            {{ sub.name }}
            <span
              v-if="!sub.enabled"
              class="ml-1 text-xs text-muted-foreground"
            >({{ t('res.notifications.off') }})</span>
          </p>
          <p class="text-xs text-muted-foreground">
            {{ sub.channel ? `${sub.channel.provider} · ${sub.channel.name}` : '—' }}
            · {{ sub.events.length }} {{ t('res.notifications.eventsCount') }}
            <template v-if="sub.minimumSeverity">
              · ≥{{ sub.minimumSeverity }}
            </template>
          </p>
          <p class="mt-1 flex flex-wrap gap-1">
            <span
              v-for="name in sub.events.slice(0, 6)"
              :key="name"
              class="rounded-md bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
            >{{ name }}</span>
            <span
              v-if="sub.events.length > 6"
              class="text-[10px] text-muted-foreground"
            >+{{ sub.events.length - 6 }}</span>
          </p>
        </div>
        <span class="flex gap-1">
          <button
            type="button"
            class="h-8 w-8 rounded-md border hover:bg-accent"
            :title="t('common.edit')"
            @click="openSubscription(sub)"
          >
            <PencilIcon class="mx-auto h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            class="h-8 w-8 rounded-md border border-destructive/40 text-destructive hover:bg-destructive/10"
            :title="t('common.delete')"
            @click="deleteSubscription(sub)"
          >
            <Trash2Icon class="mx-auto h-3.5 w-3.5" />
          </button>
        </span>
      </div>
      <p
        v-if="subscriptions.length === 0"
        class="rounded-xl border p-10 text-center text-muted-foreground"
      >
        {{ t('res.notifications.noSubscriptions') }}
      </p>
    </div>

    <!-- delivery logs -->
    <div
      v-if="tab === 'logs'"
      class="overflow-x-auto rounded-xl border"
    >
      <table class="w-full text-sm">
        <thead class="border-b bg-muted/40 text-left text-xs text-muted-foreground">
          <tr>
            <th class="px-4 py-2.5">
              {{ t('res.notifications.colStatus') }}
            </th>
            <th class="px-4 py-2.5">
              {{ t('res.friendlinks.colName') }}
            </th>
            <th class="px-4 py-2.5">
              {{ t('res.friendlinks.colLastCheck') }}
            </th>
            <th class="px-4 py-2.5 text-right">
              {{ t('res.friendlinks.colActions') }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="delivery in deliveries"
            :key="delivery.id"
            class="border-b last:border-b-0"
          >
            <td
              class="px-4 py-3"
              :class="statusClass(delivery.status)"
            >
              {{ resolveAdminDisplayLabel(t, 'notificationDeliveryStatus', delivery.status) }}
              <span class="ml-1 text-xs text-muted-foreground">×{{ delivery.attemptCount }}</span>
            </td>
            <td class="px-4 py-3">
              <p class="font-mono text-xs">
                {{ delivery.responseSummary || delivery.lastError || '—' }}
              </p>
              <p class="text-xs text-muted-foreground">
                {{ delivery.provider }} · {{ delivery.channelName ?? '—' }}
              </p>
            </td>
            <td class="px-4 py-3 text-xs text-muted-foreground">
              {{ new Date(delivery.sentAt ?? delivery.createdAt).toLocaleString() }}
            </td>
            <td class="px-4 py-3 text-right">
              <UiButton
                v-if="delivery.status === 'failed' || delivery.status === 'dead'"
                size="sm"
                variant="outline"
                @click="retryDelivery(delivery)"
              >
                {{ t('res.notifications.retry') }}
              </UiButton>
            </td>
          </tr>
          <tr v-if="deliveries.length === 0">
            <td
              colspan="4"
              class="px-4 py-10 text-center text-muted-foreground"
            >
              {{ t('res.notifications.noDeliveries') }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- channel editor dialog -->
    <Teleport to="body">
      <div
        v-if="channelOpen"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
        @click.self="channelOpen = false"
      >
        <div class="w-full max-w-lg space-y-3 rounded-xl border bg-card p-5">
          <h2 class="text-sm font-semibold">
            {{ channelForm.id ? t('res.notifications.editChannel') : t('res.notifications.addChannel') }}
          </h2>
          <label class="block space-y-1 text-sm">
            <span class="text-muted-foreground">{{ t('res.notifications.channelName') }} *</span>
            <input
              v-model="channelForm.name"
              maxlength="80"
              class="h-9 w-full rounded-md border bg-background px-3 text-sm"
            >
          </label>
          <label class="block space-y-1 text-sm">
            <span class="text-muted-foreground">{{ t('res.notifications.provider') }}</span>
            <select
              v-model="channelForm.provider"
              :disabled="Boolean(channelForm.id)"
              class="h-9 w-full rounded-md border bg-background px-2 text-sm disabled:opacity-60"
            >
              <option
                v-for="p in PROVIDERS"
                :key="p"
                :value="p"
              >
                {{ p === 'webhook' ? 'Generic Webhook' : p === 'lark' ? 'Lark / Feishu' : 'Spug Push' }}
              </option>
            </select>
          </label>
          <label class="block space-y-1 text-sm">
            <span class="text-muted-foreground">{{ t('res.notifications.pushUrl') }} *</span>
            <input
              v-model="channelForm.url"
              :placeholder="channelForm.provider === 'spug' ? 'https://push.spug.cc/send/<CODE>' : 'https://…'"
              class="h-9 w-full rounded-md border bg-background px-3 text-sm font-mono text-xs"
            >
            <span class="block text-xs text-muted-foreground">{{ t('res.notifications.pushUrlHint') }}</span>
          </label>
          <label class="block space-y-1 text-sm">
            <span class="text-muted-foreground">{{ t('res.notifications.secret') }}</span>
            <input
              v-model="channelForm.secret"
              type="password"
              :placeholder="t('res.notifications.secretKeep')"
              class="h-9 w-full rounded-md border bg-background px-3 text-sm"
            >
          </label>
          <label class="flex items-center gap-2 text-sm">
            <input
              v-model="channelForm.enabled"
              type="checkbox"
            >{{ t('res.notifications.enabledLabel') }}
          </label>
          <div class="flex justify-end gap-2 border-t pt-3">
            <UiButton
              variant="ghost"
              @click="channelOpen = false"
            >
              {{ t('common.cancel') }}
            </UiButton>
            <UiButton @click="saveChannel">
              {{ t('common.save') }}
            </UiButton>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- subscription editor dialog -->
    <Teleport to="body">
      <div
        v-if="subOpen"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
        @click.self="subOpen = false"
      >
        <div class="max-h-[90vh] w-full max-w-xl space-y-3 overflow-y-auto rounded-xl border bg-card p-5">
          <h2 class="text-sm font-semibold">
            {{ subForm.id ? t('res.notifications.editSubscription') : t('res.notifications.addSubscription') }}
          </h2>
          <div class="grid gap-3 sm:grid-cols-2">
            <label class="block space-y-1 text-sm">
              <span class="text-muted-foreground">{{ t('res.notifications.subName') }} *</span>
              <input
                v-model="subForm.name"
                maxlength="80"
                class="h-9 w-full rounded-md border bg-background px-3 text-sm"
              >
            </label>
            <label class="block space-y-1 text-sm">
              <span class="text-muted-foreground">{{ t('res.notifications.channelLabel') }} *</span>
              <select
                v-model="subForm.channelId"
                class="h-9 w-full rounded-md border bg-background px-2 text-sm"
              >
                <option
                  v-for="channel in channels"
                  :key="channel.id"
                  :value="channel.id"
                >
                  {{ channel.provider }} · {{ channel.name }}
                </option>
              </select>
            </label>
          </div>
          <label class="block space-y-1 text-sm">
            <span class="text-muted-foreground">{{ t('res.notifications.minSeverity') }}</span>
            <select
              v-model="subForm.minimumSeverity"
              class="h-9 w-full rounded-md border bg-background px-2 text-sm"
            >
              <option value="">
                {{ t('res.notifications.anySeverity') }}
              </option>
              <option
                v-for="s in SEVERITIES"
                :key="s"
                :value="s"
              >
                {{ s }}
              </option>
            </select>
          </label>
          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <span class="text-sm font-medium">{{ t('res.notifications.pickEvents') }} *</span>
              <span class="text-xs text-muted-foreground">{{ subForm.events.length }} {{ t('res.notifications.selected') }}</span>
            </div>
            <div class="relative">
              <SearchIcon class="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                v-model="eventSearch"
                type="search"
                :placeholder="t('res.notifications.searchEvents')"
                class="h-9 w-full rounded-md border bg-background pl-8 pr-3 text-sm"
              >
            </div>
            <div class="max-h-72 space-y-3 overflow-y-auto rounded-lg border p-3">
              <div
                v-for="group in eventGroups"
                :key="group.id"
                class="space-y-1"
              >
                <div class="flex items-center justify-between gap-2">
                  <p class="text-xs font-semibold">
                    {{ label(group.label) }}
                    <span class="ml-1 font-normal text-muted-foreground">{{ group.enabledCount }}/{{ group.events.length }}</span>
                  </p>
                  <span class="flex gap-1 text-[10px]">
                    <button
                      type="button"
                      class="rounded border px-1.5 py-0.5 hover:bg-accent"
                      @click="setGroup(group.id, true)"
                    >
                      {{ t('res.notifications.selectAll') }}
                    </button>
                    <button
                      type="button"
                      class="rounded border px-1.5 py-0.5 hover:bg-accent"
                      @click="setGroup(group.id, false)"
                    >
                      {{ t('res.notifications.clearGroup') }}
                    </button>
                  </span>
                </div>
                <label
                  v-for="event in group.events"
                  :key="event.name"
                  class="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
                >
                  <input
                    type="checkbox"
                    class="h-4 w-4"
                    :checked="subForm.events.includes(event.name)"
                    @change="toggleEvent(event.name)"
                  >
                  <span class="flex-1">{{ locale === 'en' ? event.label.en : event.label.zh }}</span>
                  <span
                    class="rounded px-1.5 py-0.5 text-[10px] uppercase"
                    :class="event.severity === 'error' || event.severity === 'critical' ? 'bg-destructive/10 text-destructive' : 'bg-muted text-muted-foreground'"
                  >{{ event.severity }}</span>
                </label>
              </div>
              <p
                v-if="eventDefs.length === 0"
                class="py-4 text-center text-xs text-muted-foreground"
              >
                {{ t('res.notifications.noEventsFound') }}
              </p>
            </div>
          </div>
          <div class="flex justify-end gap-2 border-t pt-3">
            <UiButton
              variant="ghost"
              @click="subOpen = false"
            >
              {{ t('common.cancel') }}
            </UiButton>
            <UiButton @click="saveSubscription">
              {{ t('common.save') }}
            </UiButton>
          </div>
        </div>
      </div>
    </Teleport>

    <div v-if="loading && channels.length === 0 && deliveries.length === 0">
      <p class="text-sm text-muted-foreground">
        {{ t('common.loading') }}
      </p>
    </div>
  </div>
</template>
