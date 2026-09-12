<template>
  <div class="space-y-6">
    <!-- store header: compact, search right (max 320px) -->
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold tracking-tight sm:text-3xl">
          {{ t('public.store.title') }}
        </h1>
        <p class="mt-1 text-sm text-muted-foreground">
          {{ t('public.store.subtitle') }}
          <NuxtLink
            to="/membership"
            class="text-primary hover:underline"
          >
            {{ t('public.membership.link') }}
          </NuxtLink>
        </p>
      </div>
      <input
        v-model="search"
        type="search"
        :placeholder="t('public.store.search')"
        class="h-9 w-full max-w-[320px] rounded-md border bg-background px-3 text-sm outline-none focus:ring-1 focus:ring-primary"
      >
    </div>

    <!-- filter toolbar: sort right -->
    <div class="flex items-center justify-end gap-2 border-b pb-3">
      <label class="flex items-center gap-1.5 text-sm text-muted-foreground">
        {{ t('public.store.sort') }}
        <select
          v-model="sort"
          class="h-9 rounded-md border bg-background px-2 text-sm"
        >
          <option value="newest">
            {{ t('public.store.sortNewest') }}
          </option>
          <option value="price-asc">
            {{ t('public.store.sortPriceAsc') }}
          </option>
          <option value="price-desc">
            {{ t('public.store.sortPriceDesc') }}
          </option>
        </select>
      </label>
    </div>

    <div
      v-if="pending"
      class="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4 xl:gap-6"
    >
      <UiSkeleton
        v-for="i in 8"
        :key="i"
        class="aspect-[4/5] w-full rounded-xl"
      />
    </div>

    <div
      v-else-if="pageProducts.length === 0"
      class="rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground"
    >
      {{ search ? t('public.search.empty') : t('public.store.empty') }}
    </div>

    <template v-else>
      <!-- responsive: 2 cols mobile (12px gap), 3 cols lg, 4 cols xl -->
      <div class="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4 xl:gap-6">
        <StoreProductCard
          v-for="product in pageProducts"
          :key="product.alias"
          :product="product"
        />
      </div>

      <PublicPagination
        :page="page"
        :total="filtered.length"
        :per-page="perPage"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import StoreProductCard from '~/components/store/ProductCard.vue'
import PublicPagination from '~/components/public/Pagination.vue'
import type { StoreProduct } from '#shared/types/store'

definePageMeta({ layout: 'public-full' })

const route = useRoute()
const { t } = useI18n()
const { localeCode } = useLocale()

const perPage = 16
const search = ref('')
const sort = ref<'newest' | 'price-asc' | 'price-desc'>((route.query.sort as 'newest') ?? 'newest')
const page = computed(() => Math.max(Number(route.query.page) || 1, 1))

const { data, pending } = await useFetch<{ products: StoreProduct[] }>(
  '/api/public/store/products',
  {
    key: `store-${localeCode.value}`,
    query: { locale: localeCode.value },
    lazy: true
  }
)

const filtered = computed(() => {
  let list = data.value?.products ?? []
  const term = search.value.trim().toLowerCase()
  if (term) {
    list = list.filter(p =>
      p.title.toLowerCase().includes(term)
      || (p.shortDescription ?? '').toLowerCase().includes(term)
    )
  }
  const price = (p: StoreProduct) => p.prices[0]?.amountMinor ?? 0
  if (sort.value === 'price-asc') list = [...list].sort((a, b) => price(a) - price(b))
  else if (sort.value === 'price-desc') list = [...list].sort((a, b) => price(b) - price(a))
  else list = [...list].sort((a, b) => b.id - a.id)
  return list
})

const pageProducts = computed(() =>
  filtered.value.slice((page.value - 1) * perPage, page.value * perPage)
)

useSeoMeta({
  title: () => t('public.store.title')
})
</script>
