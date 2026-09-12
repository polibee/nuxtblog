<template>
  <aside class="my-4 overflow-hidden rounded-xl border bg-card">
    <p
      v-if="payload.title"
      class="border-b bg-muted/40 px-4 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground"
    >
      {{ t('public.ad.label') }}
    </p>
    <ImageAd
      v-if="payload.kind === 'image'"
      :payload="payload"
    />
    <AffiliateAd
      v-else-if="payload.kind === 'affiliate'"
      :payload="payload"
    />
    <AdsenseAd
      v-else-if="payload.kind === 'adsense'"
      :payload="payload"
    />
  </aside>
</template>

<script setup lang="ts">
import type { AdPayload } from '../types/advertising'
import ImageAd from './ImageAd.vue'
import AffiliateAd from './AffiliateAd.vue'
import AdsenseAd from './AdsenseAd.vue'

defineProps<{
  payload: AdPayload
}>()

const { t } = useI18n()
</script>
