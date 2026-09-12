<script setup lang="ts">
import PublicProductImage from '~/components/public/ProductImage.vue'
import { formatMoney } from '~/utils/money'
import type { StoreProduct } from '#shared/types/store'

/* Store ProductCard (商城优化 doc): 4:3 image, 2-line title, 2-line
   description (hidden on mobile), price bottom-aligned via mt-auto,
   no big CTA — the whole card links to the detail page. */

const props = defineProps<{
  product: StoreProduct
}>()

const { t } = useI18n()

const soldOut = computed(() => props.product.availableStock <= 0)
const free = computed(() => (props.product.prices[0]?.amountMinor ?? 1) === 0)
</script>

<template>
  <article class="group overflow-hidden rounded-xl border bg-card shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
    <NuxtLink
      :to="`/store/${product.alias}`"
      class="block"
    >
      <div class="relative overflow-hidden">
        <div class="transition-transform duration-300 group-hover:scale-[1.03]">
          <PublicProductImage
            :image="product.image ?? null"
            :alt="product.title"
          />
        </div>
        <div
          v-if="soldOut"
          class="absolute inset-0 flex items-center justify-center bg-black/40"
        >
          <span class="rounded-md bg-white/90 px-3 py-1 text-xs font-medium text-neutral-900">
            {{ t('public.store.outOfStock') }}
          </span>
        </div>
      </div>

      <div class="flex flex-col p-3 sm:p-4">
        <h2 class="min-h-[2.75rem] text-base font-medium leading-snug tracking-tight group-hover:text-primary sm:min-h-[3rem]">
          {{ product.title }}
        </h2>
        <p
          v-if="product.shortDescription"
          class="mt-1 line-clamp-2 hidden text-sm leading-relaxed text-muted-foreground sm:block"
        >
          {{ product.shortDescription }}
        </p>
        <div class="mt-3 flex items-baseline justify-between gap-2 sm:mt-auto sm:pt-3">
          <span
            class="text-lg font-semibold sm:text-xl"
            :class="free ? 'text-[var(--success)]' : ''"
          >
            {{ free ? t('public.store.free') : formatMoney(product.prices[0]!.amountMinor, product.prices[0]!.currency) }}
          </span>
          <span class="hidden shrink-0 text-xs text-muted-foreground transition-colors group-hover:text-primary sm:inline">
            {{ t('public.store.viewDetail') }} →
          </span>
        </div>
      </div>
    </NuxtLink>
  </article>
</template>
