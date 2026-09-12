<template>
  <div class="space-y-6">
    <!-- breadcrumb (§36) -->
    <nav
      class="flex items-center gap-1.5 text-sm text-muted-foreground"
      aria-label="Breadcrumb"
    >
      <NuxtLink
        to="/"
        class="hover:text-foreground"
      >
        {{ t('public.nav.home') }}
      </NuxtLink>
      <span>/</span>
      <NuxtLink
        to="/store"
        class="hover:text-foreground"
      >
        {{ t('public.store.title') }}
      </NuxtLink>
      <span>/</span>
      <span class="truncate text-foreground">{{ product?.title ?? alias }}</span>
    </nav>

    <div
      v-if="pending"
      class="py-10 text-center text-sm text-muted-foreground"
    >
      {{ t('common.loading') }}
    </div>

    <div
      v-else-if="!product"
      class="rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground"
    >
      {{ t('public.store.notFound') }}
    </div>

    <template v-else>
      <!-- hero: 55/45 (§4) -->
      <div class="grid gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)] lg:gap-10">
        <!-- gallery: 4:3, max 520px, click to zoom -->
        <div>
          <button
            type="button"
            class="block w-full cursor-zoom-in overflow-hidden rounded-xl border bg-muted"
            @click="zoom = true"
          >
            <div class="max-h-[520px]">
              <PublicProductImage
                :image="product.image ?? null"
                :alt="product.title"
                eager
              />
            </div>
          </button>
        </div>

        <!-- info column (plain, no card wrapper, §80) -->
        <div class="space-y-5">
          <p class="text-sm text-muted-foreground">
            {{ product.productType === 'physical' ? t('public.store.typePhysical') : t('public.store.typeDigital') }}
          </p>
          <h1 class="text-3xl font-semibold leading-tight tracking-tight">
            {{ product.title }}
          </h1>
          <p
            v-if="product.shortDescription"
            class="line-clamp-3 text-[15px] leading-relaxed text-muted-foreground"
          >
            {{ product.shortDescription }}
          </p>

          <!-- price -->
          <div class="flex items-baseline gap-3">
            <span
              class="text-3xl font-bold"
              :class="free ? 'text-[var(--success)]' : ''"
            >
              {{ free ? t('public.store.free') : priceDisplay }}
            </span>
          </div>

          <hr class="border-border">

          <!-- quantity: only when the product allows multiples (§26) -->
          <div
            v-if="maxQuantity > 1"
            class="flex items-center gap-3"
          >
            <span class="text-sm text-muted-foreground">{{ t('public.store.quantity') }}</span>
            <div class="inline-flex items-center rounded-md border">
              <button
                type="button"
                class="h-10 w-10 text-lg disabled:opacity-40"
                :disabled="quantity <= 1"
                @click="quantity--"
              >
                −
              </button>
              <span class="w-10 text-center text-sm font-medium">{{ quantity }}</span>
              <button
                type="button"
                class="h-10 w-10 text-lg disabled:opacity-40"
                :disabled="quantity >= maxQuantity"
                @click="quantity++"
              >
                +
              </button>
            </div>
          </div>

          <p
            v-if="error"
            class="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {{ error }}
          </p>

          <!-- purchase actions (§27/28) -->
          <div class="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              class="h-12 flex-1 rounded-md bg-primary text-base font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
              :disabled="product.availableStock === 0 || buying"
              @click="buy"
            >
              {{ product.availableStock === 0 ? t('public.store.outOfStock') : buying ? t('public.store.creating') : t('public.store.buy') }}
            </button>
          </div>
          <p
            v-if="selectedPrice && maxQuantity > 1"
            class="text-sm text-muted-foreground"
          >
            {{ t('public.store.total') }}: <span class="font-medium text-foreground">{{ totalDisplay }}</span>
          </p>

          <!-- product facts (§22) -->
          <div class="space-y-1 rounded-md bg-muted p-3 text-sm text-muted-foreground">
            <p>
              {{ t('public.store.factsType') }}:
              {{ product.productType === 'physical' ? t('public.store.typePhysical') : t('public.store.typeDigital') }}
            </p>
            <p v-if="product.productType !== 'physical'">
              {{ t('public.store.factsDelivery') }}: {{ t('public.store.deliveryInstant') }}
            </p>
            <p>
              {{ t('public.store.factsStock') }}:
              {{ product.availableStock > 0 ? t('public.store.stockIn') : t('public.store.outOfStock') }}
            </p>
          </div>

          <!-- trust: only real capabilities (§32) -->
          <ul class="space-y-1 text-xs text-muted-foreground">
            <li>✓ {{ t('public.store.trustPayment') }}</li>
            <li v-if="product.productType !== 'physical'">
              ✓ {{ t('public.store.trustInstant') }}
            </li>
          </ul>
        </div>
      </div>

      <!-- description: reading width 820px (§37/38) -->
      <section
        v-if="product.description"
        class="mx-auto max-w-[820px] pt-10"
      >
        <h2 class="mb-4 text-lg font-semibold tracking-tight">
          {{ t('public.store.description') }}
        </h2>
        <div class="whitespace-pre-line text-base leading-[1.75] text-foreground/90">
          {{ product.description }}
        </div>
      </section>

      <!-- related products (§48/49) -->
      <section
        v-if="related.length"
        class="space-y-4 pt-10"
      >
        <h2 class="text-lg font-semibold tracking-tight">
          {{ t('public.store.related') }}
        </h2>
        <div class="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4 xl:gap-6">
          <StoreProductCard
            v-for="item in related"
            :key="item.alias"
            :product="item"
          />
        </div>
      </section>
    </template>

    <!-- mobile sticky purchase bar (§58-62) -->
    <div
      v-if="product && showStickyBar"
      class="fixed inset-x-0 bottom-0 z-40 flex items-center justify-between gap-3 border-t bg-background/95 px-4 py-3 backdrop-blur lg:hidden"
      style="padding-bottom: calc(0.75rem + env(safe-area-inset-bottom))"
    >
      <span class="text-xl font-bold">
        {{ free ? t('public.store.free') : priceDisplay }}
      </span>
      <button
        type="button"
        class="h-11 flex-1 max-w-[220px] rounded-md bg-primary text-sm font-medium text-primary-foreground disabled:opacity-60"
        :disabled="product.availableStock === 0 || buying"
        @click="buy"
      >
        {{ product.availableStock === 0 ? t('public.store.outOfStock') : buying ? t('public.store.creating') : t('public.store.buy') }}
      </button>
    </div>

    <!-- gallery lightbox (§11): 90vw/90vh object-contain -->
    <div
      v-if="zoom && product"
      class="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4"
      tabindex="0"
      @click.self="zoom = false"
      @keydown.esc.prevent="zoom = false"
    >
      <img
        v-if="product.image"
        :src="product.image.url"
        :alt="product.title"
        class="max-h-[90vh] max-w-[90vw] object-contain"
      >
      <button
        type="button"
        class="absolute right-4 top-4 h-9 w-9 rounded-full bg-white/10 text-white hover:bg-white/20"
        aria-label="Close"
        @click="zoom = false"
      >
        ✕
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import PublicProductImage from '~/components/public/ProductImage.vue'
import StoreProductCard from '~/components/store/ProductCard.vue'
import { formatMoney } from '~/utils/money'
import type { StoreProduct } from '#shared/types/store'

definePageMeta({ layout: 'public-full' })

const { t } = useI18n()
const { localeCode } = useLocale()
const route = useRoute()
const alias = computed(() => String(route.params.alias))

const { data, pending } = await useFetch<{ product: StoreProduct }>(
  () => `/api/public/store/products/${alias.value}`,
  { key: `store-product-${alias.value}`, query: { locale: localeCode.value } }
)

const product = computed(() => data.value?.product ?? null)

const quantity = ref(1)
const buying = ref(false)
const error = ref('')
const zoom = ref(false)
const showStickyBar = ref(false)

watch(product, () => {
  quantity.value = 1
  error.value = ''
}, { immediate: true })

const selectedPrice = computed(() =>
  product.value?.prices[0] ?? null
)

const free = computed(() => (selectedPrice.value?.amountMinor ?? 1) === 0)
const priceDisplay = computed(() =>
  selectedPrice.value ? formatMoney(selectedPrice.value.amountMinor, selectedPrice.value.currency) : '—'
)

const maxQuantity = computed(() => {
  if (!product.value) return 1
  return Math.min(product.value.maxQuantityPerOrder, Math.max(product.value.availableStock, 0)) || 1
})

const totalDisplay = computed(() => {
  if (!selectedPrice.value) return '—'
  return formatMoney(selectedPrice.value.amountMinor * quantity.value, selectedPrice.value.currency)
})

/* sticky bar appears only after scrolling past the hero buy area */
onMounted(() => {
  const onScroll = (): void => {
    showStickyBar.value = window.scrollY > 600
  }
  onScroll()
  window.addEventListener('scroll', onScroll, { passive: true })
  onBeforeUnmount(() => window.removeEventListener('scroll', onScroll))
})

/* related products load lazily after mount (§98) */
const related = ref<StoreProduct[]>([])
onMounted(async () => {
  try {
    const res = await $fetch<{ products: StoreProduct[] }>('/api/public/store/products', {
      query: { locale: localeCode.value }
    })
    related.value = (res.products ?? [])
      .filter(p => p.alias !== alias.value)
      .slice(0, 4)
  } catch {
    related.value = []
  }
})

async function buy(): Promise<void> {
  if (!product.value) return
  buying.value = true
  error.value = ''
  try {
    const created = await $fetch<{ orderNumber: string }>('/api/public/orders', {
      method: 'POST',
      body: {
        productAlias: product.value.alias,
        quantity: quantity.value,
        currency: selectedPrice.value?.currency ?? 'USD'
      }
    })
    await navigateTo(`/checkout/${created.orderNumber}`)
  } catch (e) {
    error.value = (e as Error & { data?: { message?: string } }).data?.message
      || (e as Error).message
      || t('public.store.orderFailed')
  } finally {
    buying.value = false
  }
}

useSeoMeta({
  title: () => product.value?.title ?? t('public.store.title'),
  description: () => product.value?.shortDescription ?? ''
})
</script>
