<template>
  <div class="space-y-8">
    <section class="space-y-3 py-6 text-center">
      <h1 class="text-4xl font-bold tracking-tight">
        {{ t('public.membership.title') }}
      </h1>
      <p class="mx-auto max-w-xl text-muted-foreground">
        {{ t('public.membership.subtitle') }}
      </p>
    </section>

    <div
      v-if="pending"
      class="py-10 text-center text-sm text-muted-foreground"
    >
      {{ t('common.loading') }}
    </div>

    <div
      v-else-if="plans.length === 0"
      class="rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground"
    >
      {{ t('public.membership.empty') }}
    </div>

    <div
      v-else
      class="grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
    >
      <div
        v-for="plan in plans"
        :key="plan.id"
        class="flex flex-col rounded-xl border bg-card p-6"
      >
        <h2 class="text-lg font-semibold">
          {{ plan.name }}
        </h2>
        <p
          v-if="plan.description"
          class="mt-2 line-clamp-3 text-sm text-muted-foreground"
        >
          {{ plan.description }}
        </p>
        <p class="mt-4">
          <span class="text-3xl font-bold text-primary">{{ formatMoney(plan.priceMinor, plan.currency) }}</span>
          <span class="text-sm text-muted-foreground"> / {{ plan.period === 'year' ? t('public.membership.year') : t('public.membership.month') }}</span>
        </p>
        <button
          type="button"
          class="mt-6 h-10 w-full rounded-md bg-primary text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          :disabled="buyingAlias !== null"
          @click="subscribe(plan)"
        >
          {{ buyingAlias === plan.alias ? t('public.membership.creating') : t('public.membership.subscribe') }}
        </button>
      </div>
    </div>

    <p
      v-if="error"
      class="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-center text-sm text-destructive"
    >
      {{ error }}
    </p>
  </div>
</template>

<script setup lang="ts">
interface MembershipPlan {
  id: number
  alias: string
  productAlias: string
  name: string
  description: string | null
  priceMinor: number
  currency: string
  period: string
}

definePageMeta({ layout: 'public' })

const { t } = useI18n()

const { data, pending } = await useFetch<{ plans: MembershipPlan[] }>(
  '/api/public/membership/plans',
  { key: 'membership-plans', lazy: true }
)

const plans = computed(() => data.value?.plans ?? [])
const buyingAlias = ref<string | null>(null)
const error = ref('')

/** membership grants bind to a user account: guests go sign in first */
async function subscribe(plan: MembershipPlan): Promise<void> {
  buyingAlias.value = plan.alias
  error.value = ''
  try {
    let userId: number | null = null
    try {
      const me = await $fetch<{ id: number }>('/api/auth/me')
      userId = me.id
    } catch {
      await navigateTo(`/login?redirect=${encodeURIComponent('/membership')}`)
      return
    }
    void userId
    const created = await $fetch<{ orderNumber: string }>('/api/public/orders', {
      method: 'POST',
      body: { productAlias: plan.productAlias, quantity: 1, currency: plan.currency }
    })
    await navigateTo(`/checkout/${created.orderNumber}`)
  } catch (e) {
    error.value = (e as Error & { data?: { message?: string } }).data?.message
      || (e as Error).message
      || t('public.store.orderFailed')
  } finally {
    buyingAlias.value = null
  }
}

useSeoMeta({
  title: () => t('public.membership.title')
})

// keep type-only import usage honest
</script>
