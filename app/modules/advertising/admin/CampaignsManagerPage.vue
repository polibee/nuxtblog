<script setup lang="ts">
import { useI18n } from '~/admin/i18n'
import { resolveAdminDisplayLabel } from '~/admin/i18n/display-label'
import { notify, notifyError } from '~/admin/notifications/notify'
import { formatMoney } from '~/utils/money'

/* P21 ad purchase manager: campaign list with budget/paid state, a
   purchase dialog that routes through the standard checkout, and a
   payments drawer (orders + gateway attempts + transactions). */

defineProps<{ resource: { name: string } }>()

const { t } = useI18n()

interface Campaign {
  id: number
  name: string
  status: string
  budgetMinor: number
  spentMinor: number
  currency: string
  paidAmountMinor: number
  orderId: number | null
  paidAt: string | null
  startAt: string | null
  endAt: string | null
  billingUnit: string
  billingUnits: number
  unitPriceMinor: number
  materialTitle: string | null
  materialDescription: string | null
  materialImageMediaId: number | null
  materialImageUrl?: string | null
  materialUrl: string | null
  materialSlotKey: string | null
  contactEmail: string | null
  reviewNote: string | null
  impressions: number
  clicks: number
  ctr: number
  creatives: Array<{ id: number, provider: string, enabled: boolean, impressions: number, clicks: number }>
  placements: Array<{ id: number, slotKey: string, slotName: string | null, priority: number, enabled: boolean }>
}

interface Attempt {
  id: number
  gatewayKey: string
  status: string
  amountMinor: number
  currency: string
  createdAt: string
}

interface Transaction {
  id: number
  transactionNumber: string
  type: string
  status: string
  amountMinor: number
  currency: string
  gatewayKey: string
  occurredAt: string
}

interface PaymentRecord {
  orderId: number
  orderNumber: string
  status: string
  paymentStatus: string
  totalAmountMinor: number
  currency: string
  createdAt: string
  paidAt: string | null
  attempts: Attempt[]
  transactions: Transaction[]
}

const campaigns = ref<Campaign[]>([])
const loading = ref(false)
const error = ref('')

const purchaseFor = ref<Campaign | null>(null)
const purchaseBudget = ref(0)
const purchaseCurrency = ref('USD')
const purchasing = ref(false)

const purchaseEnabled = ref(true)
const reviewEnabled = ref(true)
const rejectFor = ref<Campaign | null>(null)
const rejectNote = ref('')
const detailsFor = ref<Campaign | null>(null)

async function loadPurchaseEnabled(): Promise<void> {
  try {
    const res = await $fetch<{ enabled: boolean }>('/api/admin/advertising/purchase-enabled')
    purchaseEnabled.value = res.enabled
  } catch {
    purchaseEnabled.value = true
  }
}

async function togglePurchaseEnabled(): Promise<void> {
  try {
    await $fetch('/api/admin/advertising/purchase-enabled', {
      method: 'PUT',
      body: { enabled: purchaseEnabled.value }
    })
    notify(t('res.slider.saved'))
  } catch (e) {
    notifyError(t('res.adpurchase.failed'), (e as Error).message)
    purchaseEnabled.value = !purchaseEnabled.value
  }
}

async function loadReviewEnabled(): Promise<void> {
  try {
    const res = await $fetch<{ enabled: boolean }>('/api/admin/advertising/review-enabled')
    reviewEnabled.value = res.enabled
  } catch {
    reviewEnabled.value = true
  }
}

async function toggleReviewEnabled(): Promise<void> {
  try {
    await $fetch('/api/admin/advertising/review-enabled', { method: 'PUT', body: { enabled: reviewEnabled.value } })
    notify(t('res.adreview.settingSaved'))
  } catch (e) {
    notifyError(t('res.adreview.failed'), (e as Error).message)
    reviewEnabled.value = !reviewEnabled.value
  }
}

async function toggleCampaign(campaign: Campaign): Promise<void> {
  const status = campaign.status === 'paused' ? 'active' : 'paused'
  try {
    await $fetch(`/api/admin/advertising/campaigns/${campaign.id}`, { method: 'PUT', body: { status } })
    notify(resolveAdminDisplayLabel(t, 'campaignToggleNotice', status))
    await loadCampaigns()
  } catch (e) {
    notifyError(t('res.adreview.failed'), (e as Error).message)
  }
}

async function approve(campaign: Campaign): Promise<void> {
  try {
    await $fetch(`/api/admin/advertising/campaigns/${campaign.id}/approve`, { method: 'POST' })
    notify(t('res.adreview.approved'))
    await loadCampaigns()
  } catch (e) {
    notifyError(t('res.adreview.failed'), (e as Error).message)
  }
}

async function reject(): Promise<void> {
  const campaign = rejectFor.value
  if (!campaign) return
  try {
    await $fetch(`/api/admin/advertising/campaigns/${campaign.id}/reject`, {
      method: 'POST',
      body: { note: rejectNote.value }
    })
    rejectFor.value = null
    rejectNote.value = ''
    notify(t('res.adreview.rejected'))
    await loadCampaigns()
  } catch (e) {
    notifyError(t('res.adreview.failed'), (e as Error).message)
  }
}

const paymentsFor = ref<Campaign | null>(null)
const payments = ref<PaymentRecord[] | null>(null)
const paymentsLoading = ref(false)

async function loadCampaigns(): Promise<void> {
  loading.value = true
  try {
    const res = await $fetch<{ items: Campaign[] }>('/api/admin/advertising/campaigns')
    campaigns.value = res.items
    error.value = ''
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    loading.value = false
  }
}

const statusStyle: Record<string, string> = {
  draft: 'text-warning',
  active: 'text-[var(--success)]',
  paused: 'text-muted-foreground',
  ended: 'text-destructive',
  pending_review: 'text-warning',
  rejected: 'text-destructive'
}

function openPurchase(campaign: Campaign): void {
  purchaseFor.value = campaign
  purchaseBudget.value = campaign.budgetMinor || 0
  purchaseCurrency.value = campaign.currency || 'USD'
}

function previewCampaign(campaign: Campaign): void {
  if (campaign.materialUrl && import.meta.client) window.open(campaign.materialUrl, '_blank', 'noopener,noreferrer')
}

async function submitPurchase(): Promise<void> {
  const campaign = purchaseFor.value
  if (!campaign) return
  if (purchaseBudget.value <= 0) {
    notifyError(t('res.adpurchase.failed'), t('res.adpurchase.budgetRequired'))
    return
  }
  purchasing.value = true
  try {
    const res = await $fetch<{ orderNumber: string }>(`/api/admin/advertising/campaigns/${campaign.id}/purchase`, {
      method: 'POST',
      body: { budgetMinor: purchaseBudget.value, currency: purchaseCurrency.value }
    })
    purchaseFor.value = null
    notify(t('res.adpurchase.orderCreated'))
    await navigateTo(`/checkout/${res.orderNumber}`)
  } catch (e) {
    notifyError(t('res.adpurchase.failed'), (e as Error).message)
  } finally {
    purchasing.value = false
  }
}

async function openPayments(campaign: Campaign): Promise<void> {
  paymentsFor.value = campaign
  payments.value = null
  paymentsLoading.value = true
  try {
    const res = await $fetch<{ payments: PaymentRecord[] }>(`/api/admin/advertising/campaigns/${campaign.id}/payments`)
    payments.value = res.payments
  } catch (e) {
    notifyError(t('res.adpayments.loadFailed'), (e as Error).message)
    payments.value = []
  } finally {
    paymentsLoading.value = false
  }
}

onMounted(async () => {
  await loadCampaigns()
  await loadPurchaseEnabled()
  await loadReviewEnabled()
})
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <h1 class="text-2xl font-semibold tracking-tight">
        {{ t('res.adcampaigns.label') }}
      </h1>
      <div class="flex items-center gap-3">
        <label class="flex items-center gap-2 text-sm text-muted-foreground">
          {{ t('res.adpurchase.pageEnabled') }}
          <UiSwitch
            :model-value="purchaseEnabled"
            @update:model-value="purchaseEnabled = $event as boolean; togglePurchaseEnabled()"
          />
        </label>
        <label class="flex items-center gap-2 text-sm text-muted-foreground">
          {{ t('res.adreview.setting') }}
          <UiSwitch
            :model-value="reviewEnabled"
            @update:model-value="reviewEnabled = $event as boolean; toggleReviewEnabled()"
          />
        </label>
        <NuxtLink
          to="/admin/advertising/campaigns/create"
          class="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          {{ t('res.adcampaigns.new') }}
        </NuxtLink>
      </div>
    </div>

    <p
      v-if="error"
      class="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive"
    >
      {{ error }}
    </p>

    <div class="overflow-x-auto rounded-xl border">
      <table class="w-full text-sm">
        <thead class="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th class="px-4 py-3">
              {{ t('res.adcampaigns.col.name') }}
            </th>
            <th class="px-4 py-3">
              {{ t('res.trans.col.status') }}
            </th>
            <th class="px-4 py-3">
              {{ t('res.adcampaigns.slot') }}
            </th>
            <th class="px-4 py-3">
              {{ t('res.adcampaigns.delivery') }}
            </th>
            <th class="px-4 py-3">
              {{ t('res.adcampaigns.field.budget') }}
            </th>
            <th class="px-4 py-3">
              {{ t('res.adpurchase.spent') }}
            </th>
            <th class="px-4 py-3">
              {{ t('res.adpurchase.paid') }}
            </th>
            <th class="px-4 py-3">
              {{ t('res.adpurchase.order') }}
            </th>
            <th class="px-4 py-3">
              {{ t('res.adcampaigns.metrics') }}
            </th>
            <th class="px-4 py-3 text-right">
              {{ t('res.adcampaigns.actions') }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-if="loading"
          >
            <td
              colspan="10"
              class="px-4 py-10 text-center text-muted-foreground"
            >
              {{ t('common.loading') }}
            </td>
          </tr>
          <tr
            v-else-if="campaigns.length === 0"
          >
            <td
              colspan="10"
              class="px-4 py-10 text-center text-muted-foreground"
            >
              {{ t('res.adcampaigns.empty') }}
            </td>
          </tr>
          <tr
            v-for="campaign in campaigns"
            :key="campaign.id"
            class="border-t transition-colors hover:bg-accent/30"
          >
            <td class="px-4 py-3 font-medium">
              {{ campaign.name }}
            </td>
            <td class="px-4 py-3">
              <span
                class="text-xs font-medium"
                :class="statusStyle[campaign.status] ?? 'text-muted-foreground'"
              >
                {{ resolveAdminDisplayLabel(t, 'campaignStatus', campaign.status) }}
              </span>
            </td>
            <td class="px-4 py-3 text-xs text-muted-foreground">
              {{ campaign.materialSlotKey || '—' }}
            </td>
            <td class="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
              {{ campaign.startAt ? new Date(campaign.startAt).toLocaleDateString() : '—' }}
              <span v-if="campaign.endAt"> → {{ new Date(campaign.endAt).toLocaleDateString() }}</span>
            </td>
            <td class="px-4 py-3">
              {{ formatMoney(campaign.budgetMinor, campaign.currency) }}
            </td>
            <td class="min-w-40 px-4 py-3">
              <div class="mb-1 flex justify-between text-xs text-muted-foreground">
                <span>{{ formatMoney(campaign.spentMinor ?? 0, campaign.currency) }}</span>
                <span>{{ campaign.budgetMinor > 0 ? Math.min(100, Math.round((campaign.spentMinor ?? 0) / campaign.budgetMinor * 100)) : 0 }}%</span>
              </div>
              <div class="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  class="h-full rounded-full bg-primary transition-[width]"
                  :style="{ width: `${campaign.budgetMinor > 0 ? Math.min(100, (campaign.spentMinor ?? 0) / campaign.budgetMinor * 100) : 0}%` }"
                />
              </div>
            </td>
            <td class="px-4 py-3">
              <template v-if="campaign.paidAt">
                {{ formatMoney(campaign.paidAmountMinor, campaign.currency) }}
                <span class="block text-xs text-muted-foreground">{{ new Date(campaign.paidAt).toLocaleDateString() }}</span>
              </template>
              <span
                v-else
                class="text-xs text-muted-foreground"
              >—</span>
            </td>
            <td class="px-4 py-3 text-xs text-muted-foreground">
              <template v-if="campaign.orderId">
                #{{ campaign.orderId }}
              </template>
              <template v-else>
                —
              </template>
            </td>
            <td class="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
              {{ campaign.impressions }} {{ t('res.adcampaigns.impressions') }} · {{ campaign.clicks }} {{ t('res.adcampaigns.clicks') }}
              <span class="block">{{ t('res.adcampaigns.ctr') }} {{ campaign.ctr.toFixed(2) }}</span>
            </td>
            <td class="px-4 py-3">
              <div class="flex justify-end gap-1.5">
                <button
                  type="button"
                  class="h-8 rounded-md border px-3 text-xs hover:bg-accent"
                  @click="detailsFor = campaign"
                >
                  {{ t('res.adcampaigns.details') }}
                </button>
                <template v-if="campaign.status === 'pending_review'">
                  <button
                    type="button"
                    class="h-8 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                    @click="approve(campaign)"
                  >
                    {{ t('res.adreview.approve') }}
                  </button>
                  <button
                    type="button"
                    class="h-8 rounded-md border border-destructive/40 px-3 text-xs text-destructive hover:bg-destructive/10"
                    @click="rejectFor = campaign; rejectNote = ''"
                  >
                    {{ t('res.adreview.reject') }}
                  </button>
                </template>
                <button
                  v-if="campaign.status === 'active' || campaign.status === 'paused'"
                  type="button"
                  class="h-8 rounded-md border px-3 text-xs hover:bg-accent"
                  @click="toggleCampaign(campaign)"
                >
                  {{ resolveAdminDisplayLabel(t, 'campaignToggleAction', campaign.status) }}
                </button>
                <button
                  type="button"
                  class="h-8 rounded-md border px-3 text-xs hover:bg-accent"
                  @click="openPayments(campaign)"
                >
                  {{ t('res.adpayments.view') }}
                </button>
                <button
                  v-if="campaign.status === 'draft'"
                  type="button"
                  class="h-8 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                  @click="openPurchase(campaign)"
                >
                  {{ t('res.adpurchase.buy') }}
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- campaign detail drawer -->
    <div
      v-if="detailsFor"
      class="fixed inset-0 z-50 flex justify-end bg-black/40"
      @click.self="detailsFor = null"
    >
      <aside class="flex h-full w-full max-w-xl flex-col overflow-y-auto border-l bg-background p-5">
        <div class="mb-5 flex items-start justify-between gap-3">
          <div>
            <p class="text-xs uppercase tracking-wide text-muted-foreground">
              {{ t('res.adcampaigns.details') }}
            </p>
            <h2 class="text-xl font-semibold">
              {{ detailsFor.name }}
            </h2>
          </div>
          <button
            type="button"
            class="h-8 w-8 rounded border hover:bg-accent"
            @click="detailsFor = null"
          >
            ✕
          </button>
        </div>
        <div class="grid grid-cols-2 gap-3 text-sm">
          <div class="rounded-lg border p-3">
            <p class="text-xs text-muted-foreground">
              {{ t('res.adcampaigns.slot') }}
            </p><p class="mt-1 font-medium">
              {{ detailsFor.materialSlotKey || '—' }}
            </p>
          </div>
          <div class="rounded-lg border p-3">
            <p class="text-xs text-muted-foreground">
              {{ t('res.adcampaigns.delivery') }}
            </p><p class="mt-1 font-medium">
              {{ detailsFor.startAt ? new Date(detailsFor.startAt).toLocaleDateString() : '—' }} → {{ detailsFor.endAt ? new Date(detailsFor.endAt).toLocaleDateString() : '—' }}
            </p>
          </div>
          <div class="rounded-lg border p-3">
            <p class="text-xs text-muted-foreground">
              {{ t('res.adcampaigns.priceSnapshot') }}
            </p><p class="mt-1 font-medium">
              {{ formatMoney(detailsFor.unitPriceMinor || 0, detailsFor.currency) }} / {{ detailsFor.billingUnit }} × {{ detailsFor.billingUnits || 1 }}
            </p>
          </div>
          <div class="rounded-lg border p-3">
            <p class="text-xs text-muted-foreground">
              {{ t('res.adcampaigns.metrics') }}
            </p><p class="mt-1 font-medium">
              {{ detailsFor.impressions }} / {{ detailsFor.clicks }} · {{ t('res.adcampaigns.ctr') }} {{ detailsFor.ctr.toFixed(2) }}
            </p>
          </div>
        </div>
        <section class="mt-5 rounded-xl border p-4">
          <h3 class="mb-3 font-medium">
            {{ t('res.adcampaigns.material') }}
          </h3>
          <p class="font-medium">
            {{ detailsFor.materialTitle || detailsFor.name }}
          </p>
          <p
            v-if="detailsFor.materialDescription"
            class="mt-2 whitespace-pre-wrap text-sm text-muted-foreground"
          >
            {{ detailsFor.materialDescription }}
          </p>
          <a
            v-if="detailsFor.materialUrl"
            :href="detailsFor.materialUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="mt-3 block truncate text-sm text-primary hover:underline"
          >{{ detailsFor.materialUrl }}</a>
          <img
            v-if="detailsFor.materialImageUrl"
            :src="detailsFor.materialImageUrl"
            :alt="detailsFor.materialTitle || detailsFor.name"
            class="mt-4 max-h-56 w-full rounded-lg object-contain bg-muted/30"
          >
          <p
            v-if="detailsFor.contactEmail"
            class="mt-3 text-xs text-muted-foreground"
          >
            {{ detailsFor.contactEmail }}
          </p>
          <p
            v-if="detailsFor.reviewNote"
            class="mt-3 rounded-md bg-destructive/10 p-2 text-sm text-destructive"
          >
            {{ detailsFor.reviewNote }}
          </p>
        </section>
        <section class="mt-4 grid gap-4 sm:grid-cols-2">
          <div class="rounded-xl border p-4">
            <div class="mb-3 flex items-center justify-between gap-2">
              <h3 class="font-medium">
                {{ t('res.adcampaigns.creatives') }}
              </h3>
              <NuxtLink
                to="/admin/advertising/creatives"
                class="text-xs text-primary hover:underline"
              >
                {{ t('res.adcampaigns.manage') }}
              </NuxtLink>
            </div>
            <p
              v-if="detailsFor.creatives.length === 0"
              class="text-sm text-muted-foreground"
            >
              {{ t('res.adcampaigns.noCreatives') }}
            </p>
            <ul
              v-else
              class="space-y-2 text-sm"
            >
              <li
                v-for="creative in detailsFor.creatives"
                :key="creative.id"
                class="flex items-center justify-between gap-2"
              >
                <span>#{{ creative.id }} · {{ creative.provider }}</span>
                <span class="text-xs text-muted-foreground">{{ creative.impressions }} / {{ creative.clicks }} · {{ creative.enabled ? t('res.sidebar.enabled') : t('res.sidebar.disabled') }}</span>
              </li>
            </ul>
          </div>
          <div class="rounded-xl border p-4">
            <div class="mb-3 flex items-center justify-between gap-2">
              <h3 class="font-medium">
                {{ t('res.adcampaigns.placements') }}
              </h3>
              <NuxtLink
                to="/admin/advertising/placements"
                class="text-xs text-primary hover:underline"
              >
                {{ t('res.adcampaigns.manage') }}
              </NuxtLink>
            </div>
            <p
              v-if="detailsFor.placements.length === 0"
              class="text-sm text-muted-foreground"
            >
              {{ t('res.adcampaigns.noPlacements') }}
            </p>
            <ul
              v-else
              class="space-y-2 text-sm"
            >
              <li
                v-for="placement in detailsFor.placements"
                :key="placement.id"
                class="flex items-center justify-between gap-2"
              >
                <span>{{ placement.slotName || placement.slotKey }}</span>
                <span class="text-xs text-muted-foreground">{{ placement.enabled ? t('res.sidebar.enabled') : t('res.sidebar.disabled') }}</span>
              </li>
            </ul>
          </div>
        </section>
        <div class="mt-5 flex flex-wrap gap-2">
          <button
            v-if="detailsFor.materialUrl"
            type="button"
            class="h-9 rounded-md border px-4 text-sm hover:bg-accent"
            @click="previewCampaign(detailsFor)"
          >
            {{ t('res.adcampaigns.preview') }}
          </button>
          <button
            v-if="detailsFor.status === 'active' || detailsFor.status === 'paused'"
            type="button"
            class="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            @click="toggleCampaign(detailsFor); detailsFor = null"
          >
            {{ resolveAdminDisplayLabel(t, 'campaignToggleAction', detailsFor.status) }}
          </button>
        </div>
      </aside>
    </div>

    <!-- purchase dialog -->
    <div
      v-if="purchaseFor"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      @click.self="purchaseFor = null"
    >
      <div class="w-full max-w-md space-y-4 rounded-xl border bg-background p-5">
        <h2 class="text-lg font-semibold">
          {{ t('res.adpurchase.title') }} · {{ purchaseFor.name }}
        </h2>
        <p class="text-xs text-muted-foreground">
          {{ t('res.adpurchase.hint') }}
        </p>
        <label class="block space-y-1 text-sm">
          <span class="text-muted-foreground">{{ t('res.adcampaigns.field.budget') }}</span>
          <input
            v-model.number="purchaseBudget"
            type="number"
            min="1"
            class="h-9 w-full rounded-md border bg-background px-3 text-sm"
          >
        </label>
        <label class="block space-y-1 text-sm">
          <span class="text-muted-foreground">{{ t('res.adcampaigns.field.currency') }}</span>
          <select
            v-model="purchaseCurrency"
            class="h-9 w-full rounded-md border bg-background px-2 text-sm"
          >
            <option value="USD">
              USD
            </option>
            <option value="CNY">
              CNY
            </option>
            <option value="EUR">
              EUR
            </option>
          </select>
        </label>
        <p class="text-sm">
          {{ t('res.adpurchase.payable') }}:
          <strong>{{ formatMoney(purchaseBudget, purchaseCurrency) }}</strong>
        </p>
        <div class="flex justify-end gap-2">
          <button
            type="button"
            class="h-9 rounded-md border px-4 text-sm hover:bg-accent"
            @click="purchaseFor = null"
          >
            {{ t('common.cancel') }}
          </button>
          <button
            type="button"
            class="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            :disabled="purchasing"
            @click="submitPurchase"
          >
            {{ purchasing ? t('common.saving') : t('res.adpurchase.gotoCheckout') }}
          </button>
        </div>
      </div>
    </div>

    <!-- reject dialog -->
    <div
      v-if="rejectFor"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      @click.self="rejectFor = null"
    >
      <div class="w-full max-w-md space-y-4 rounded-xl border bg-background p-5">
        <h2 class="text-lg font-semibold">
          {{ t('res.adreview.rejectTitle') }} · {{ rejectFor.name }}
        </h2>
        <textarea
          v-model="rejectNote"
          rows="3"
          maxlength="500"
          :placeholder="t('res.adreview.rejectPlaceholder')"
          class="w-full rounded-md border bg-background px-3 py-2 text-sm"
        />
        <div class="flex justify-end gap-2">
          <button
            type="button"
            class="h-9 rounded-md border px-4 text-sm hover:bg-accent"
            @click="rejectFor = null"
          >
            {{ t('common.cancel') }}
          </button>
          <button
            type="button"
            class="h-9 rounded-md bg-destructive px-4 text-sm font-medium text-destructive-foreground hover:bg-destructive/90"
            @click="reject"
          >
            {{ t('res.adreview.reject') }}
          </button>
        </div>
      </div>
    </div>

    <!-- payments drawer -->
    <div
      v-if="paymentsFor"
      class="fixed inset-0 z-50 flex justify-end bg-black/40"
      @click.self="paymentsFor = null"
    >
      <div class="flex h-full w-full max-w-lg flex-col overflow-y-auto border-l bg-background p-5">
        <div class="mb-4 flex items-start justify-between gap-2">
          <h2 class="text-lg font-semibold">
            {{ t('res.adpayments.title') }} · {{ paymentsFor.name }}
          </h2>
          <button
            type="button"
            class="h-7 w-7 shrink-0 rounded border text-xs hover:bg-accent"
            @click="paymentsFor = null"
          >
            ✕
          </button>
        </div>

        <p
          v-if="paymentsLoading"
          class="py-10 text-center text-sm text-muted-foreground"
        >
          {{ t('common.loading') }}
        </p>
        <p
          v-else-if="!payments?.length"
          class="rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground"
        >
          {{ t('res.adpayments.empty') }}
        </p>

        <div
          v-for="record in payments"
          :key="record.orderId"
          class="mb-4 rounded-xl border p-4"
        >
          <div class="mb-2 flex items-center justify-between gap-2">
            <p class="font-medium">
              {{ record.orderNumber }}
            </p>
            <span class="text-xs text-muted-foreground">
              {{ record.status }} / {{ record.paymentStatus }}
            </span>
          </div>
          <p class="mb-3 text-sm">
            {{ formatMoney(record.totalAmountMinor, record.currency) }}
            <span
              v-if="record.paidAt"
              class="text-xs text-muted-foreground"
            >
              · {{ new Date(record.paidAt).toLocaleString() }}
            </span>
          </p>

          <p class="mb-1 text-xs font-medium text-muted-foreground">
            {{ t('res.adpayments.gateways') }}
          </p>
          <ul class="mb-3 space-y-0.5 text-xs text-muted-foreground">
            <li
              v-for="attempt in record.attempts"
              :key="attempt.id"
              class="flex justify-between"
            >
              <span>{{ attempt.gatewayKey }}</span>
              <span>{{ attempt.status }} · {{ formatMoney(attempt.amountMinor, attempt.currency) }}</span>
            </li>
          </ul>

          <p class="mb-1 text-xs font-medium text-muted-foreground">
            {{ t('res.adpayments.transactions') }}
          </p>
          <ul class="space-y-0.5 text-xs text-muted-foreground">
            <li
              v-for="transaction in record.transactions"
              :key="transaction.id"
              class="flex justify-between gap-2"
            >
              <span class="truncate">{{ transaction.transactionNumber }} ({{ transaction.type }})</span>
              <span class="shrink-0">
                {{ formatMoney(transaction.amountMinor, transaction.currency) }} · {{ transaction.gatewayKey }} · {{ transaction.status }}
              </span>
            </li>
            <li
              v-if="record.transactions.length === 0"
              class="italic"
            >
              —
            </li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</template>
