<template>
  <div class="mx-auto max-w-2xl space-y-6">
    <h1 class="text-2xl font-bold tracking-tight">
      {{ t('public.checkout.title') }}
    </h1>

    <div
      v-if="pending"
      class="py-10 text-center text-sm text-muted-foreground"
    >
      {{ t('common.loading') }}
    </div>

    <div
      v-else-if="!order"
      class="rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground"
    >
      {{ t('public.checkout.notFound') }}
    </div>

    <template v-else>
      <!-- 订单摘要 -->
      <div class="rounded-lg border bg-card p-5">
        <div class="flex items-center justify-between">
          <span class="font-mono text-sm text-muted-foreground">{{ order.orderNumber }}</span>
          <span
            class="rounded px-2 py-0.5 text-xs font-medium"
            :class="statusBadgeClass"
          >
            {{ statusLabel }}
          </span>
        </div>
        <ul class="mt-3 divide-y">
          <li
            v-for="item in order.items"
            :key="item.productAlias"
            class="flex items-center justify-between py-2 text-sm"
          >
            <span>{{ item.title }} × {{ item.quantity }}</span>
            <span class="font-medium">{{ formatMoney(item.totalAmountMinor, item.currency) }}</span>
          </li>
        </ul>
        <div class="mt-2 flex items-center justify-between border-t pt-3">
          <span class="text-sm font-medium">{{ t('public.checkout.total') }}</span>
          <span class="text-xl font-bold text-primary">{{ formatMoney(order.totalMinor, order.currency) }}</span>
        </div>
      </div>

      <!-- 交付内容 -->
      <div
        v-if="order.deliveries.length > 0"
        class="rounded-lg border border-emerald-500/40 bg-emerald-500/5 p-5"
      >
        <h2 class="text-sm font-semibold text-emerald-600">
          {{ t('public.checkout.deliveries') }}
        </h2>
        <ul class="mt-3 space-y-2">
          <li
            v-for="delivery in visibleDeliveries"
            :key="delivery.id"
            class="flex items-center justify-between gap-3 rounded-md border bg-background px-3 py-2 font-mono text-sm"
          >
            <span class="break-all">{{ delivery.text }}</span>
            <span
              v-if="delivery.masked"
              class="shrink-0 rounded bg-muted px-1.5 py-0.5 text-xs font-sans text-muted-foreground"
            >{{ t('public.checkout.structured') }}</span>
          </li>
        </ul>
        <button
          v-if="hasMaskedDeliveries"
          type="button"
          class="mt-3 h-9 rounded-md border px-4 text-sm hover:bg-accent disabled:opacity-60"
          :disabled="revealing"
          @click="revealAll"
        >
          {{ revealing ? t('common.loading') : t('public.checkout.reveal') }}
        </button>
        <p
          v-if="revealError"
          class="mt-2 text-xs text-destructive"
        >
          {{ revealError }}
        </p>
      </div>

      <!-- 待支付：选择渠道并发起支付 -->
      <div v-else-if="order.status === 'pending_payment'">
        <div
          v-if="methods.length === 0 && !paying"
          class="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground"
        >
          {{ t('public.checkout.noMethods') }}
        </div>

        <div
          v-else-if="!paying"
          class="rounded-lg border bg-card p-5"
        >
          <h2 class="text-sm font-semibold">
            {{ t('public.checkout.chooseMethod') }}
          </h2>
          <div class="mt-3 space-y-2">
            <label
              v-for="method in methods"
              :key="method.key"
              class="flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2 text-sm has-[:checked]:border-primary"
            >
              <input
                v-model="selectedGateway"
                type="radio"
                name="gateway"
                :value="method.key"
                class="h-4 w-4"
              >
              <span class="font-medium">{{ method.displayName }}</span>
              <span class="ml-auto text-xs text-muted-foreground">{{ method.providerKey }}</span>
            </label>
          </div>

          <p
            v-if="error"
            class="mt-3 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {{ error }}
          </p>

          <button
            type="button"
            class="mt-4 h-10 w-full rounded-md bg-primary text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            :disabled="!selectedGateway"
            @click="pay"
          >
            {{ t('public.checkout.payNow') }}
          </button>
        </div>

        <div
          v-else
          class="rounded-lg border bg-card p-8 text-center"
        >
          <p class="text-sm text-muted-foreground">
            {{ t('public.checkout.redirecting') }}
          </p>
          <p
            v-if="selectedGatewayLabel"
            class="mt-1 text-sm font-medium"
          >
            {{ selectedGatewayLabel }}
          </p>
        </div>
      </div>

      <!-- 已支付等待交付 / 其他终态 -->
      <div
        v-else-if="order.paymentStatus === 'captured'"
        class="rounded-lg border border-emerald-500/40 bg-emerald-500/5 p-5 text-center text-sm text-emerald-600"
      >
        {{ t('public.checkout.processingDelivery') }}
      </div>

      <NuxtLink
        to="/store"
        class="inline-block text-sm text-muted-foreground hover:text-foreground"
      >
        ← {{ t('public.store.backToList') }}
      </NuxtLink>
    </template>
  </div>
</template>

<script setup lang="ts">
interface CheckoutOrder {
  orderNumber: string
  status: string
  paymentStatus: string
  fulfillmentStatus: string
  totalMinor: number
  currency: string
  items: Array<{ productAlias: string, title: string, quantity: number, totalAmountMinor: number, currency: string, deliveryStrategy?: string }>
  deliveries: Array<{ id: number, strategy: string, secret?: string, masked?: string, deliveryRowId?: number }>
}

interface CheckoutMethod {
  key: string
  displayName: string
  providerKey: string
}

definePageMeta({ layout: 'public' })

const { t } = useI18n()
const route = useRoute()
const orderNumber = computed(() => String(route.params.orderNumber))

const { data, pending, refresh } = await useFetch<CheckoutOrder>(
  () => `/api/public/orders/${orderNumber.value}`,
  { key: `checkout-${orderNumber.value}` }
)

const order = computed(() => data.value ?? null)

/* structured_reveal entries stay masked until the buyer reveals them */
const revealedSecrets = ref<Array<{ id: number, secret: string }>>([])
const revealing = ref(false)
const revealError = ref('')

const visibleDeliveries = computed(() => {
  const deliveries = order.value?.deliveries ?? []
  return deliveries.map((delivery) => {
    if (delivery.secret) return { ...delivery, text: delivery.secret }
    const revealed = revealedSecrets.value.find(s => s.id === delivery.id)
    return { ...delivery, text: revealed?.secret ?? delivery.masked ?? '' }
  })
})

const hasMaskedDeliveries = computed(() =>
  (order.value?.deliveries ?? []).some(d => !d.secret)
  && revealedSecrets.value.length === 0
)

async function revealAll(): Promise<void> {
  const delivery = order.value?.deliveries.find(d => !d.secret)
  if (!delivery) return
  revealing.value = true
  revealError.value = ''
  try {
    const res = await $fetch<{ secrets: Array<{ id: number, secret: string }> }>(
      `/api/public/orders/${orderNumber.value}/delivery/reveal`,
      { method: 'POST', body: { deliveryId: delivery.deliveryRowId ?? delivery.id } }
    )
    revealedSecrets.value = res.secrets
  } catch (e) {
    revealError.value = (e as Error & { data?: { message?: string } }).data?.message
      || (e as Error).message
      || t('public.checkout.payFailed')
  } finally {
    revealing.value = false
  }
}

const methods = ref<CheckoutMethod[]>([])
const selectedGateway = ref('')
const paying = ref(false)
const error = ref('')

watch(order, async (value) => {
  if (!value || value.status !== 'pending_payment' || methods.value.length > 0) return
  const res = await $fetch<{ methods: CheckoutMethod[] }>('/api/public/payments/methods', {
    query: { currency: value.currency }
  })
  methods.value = res.methods
  if (methods.value.length === 1) selectedGateway.value = methods.value[0]!.key
}, { immediate: true })

const selectedGatewayLabel = computed(() =>
  methods.value.find(m => m.key === selectedGateway.value)?.displayName ?? ''
)

const statusLabel = computed(() => {
  if (!order.value) return ''
  if (order.value.deliveries.length > 0) return t('public.checkout.state.delivered')
  if (order.value.paymentStatus === 'captured') return t('public.checkout.state.paid')
  if (order.value.status === 'pending_payment') return t('public.checkout.state.pending')
  if (order.value.status === 'expired') return t('public.checkout.state.expired')
  if (order.value.status === 'canceled') return t('public.checkout.state.canceled')
  return order.value.status
})

const statusBadgeClass = computed(() => {
  if (!order.value) return ''
  if (order.value.deliveries.length > 0 || order.value.paymentStatus === 'captured') {
    return 'bg-emerald-500/15 text-emerald-600'
  }
  if (order.value.status === 'pending_payment') return 'bg-amber-500/15 text-amber-600'
  return 'bg-muted text-muted-foreground'
})

async function pay(): Promise<void> {
  if (!selectedGateway.value) return
  paying.value = true
  error.value = ''
  try {
    const result = await $fetch<{ approvalUrl: string }>(
      `/api/public/orders/${orderNumber.value}/payment`,
      { method: 'POST', body: { gatewayKey: selectedGateway.value } }
    )
    if (/^https?:\/\//i.test(result.approvalUrl)) {
      // hosted checkout on the provider side; the return URL comes back here
      await navigateTo(result.approvalUrl, { external: true })
    }
    // site-relative (mock/self-hosted): status polling self-heals the state
    await startPolling()
  } catch (e) {
    error.value = (e as Error & { data?: { message?: string } }).data?.message
      || (e as Error).message
      || t('public.checkout.payFailed')
  } finally {
    paying.value = false
  }
}

let pollTimer: ReturnType<typeof setInterval> | null = null

function startPolling(): void {
  if (pollTimer) return
  pollTimer = setInterval(async () => {
    if (order.value && order.value.status !== 'pending_payment') {
      stopPolling()
      return
    }
    await refresh()
    if (order.value && order.value.status !== 'pending_payment') stopPolling()
  }, 3000)
}

function stopPolling(): void {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

onUnmounted(stopPolling)

// arriving from a provider return URL (?payment=...) with payment still
// pending: poll for server-side capture progress (browser only)
onMounted(() => {
  if (order.value?.status === 'pending_payment' && methods.value.length === 0) {
    startPolling()
  }
})
</script>
