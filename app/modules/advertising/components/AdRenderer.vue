<template>
  <div class="w-full min-w-0 overflow-hidden">
    <p
      class="border-b bg-muted/35 px-4 py-2 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground"
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
  </div>
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
