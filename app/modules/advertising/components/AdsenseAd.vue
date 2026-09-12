<template>
  <div class="p-4">
    <ins
      class="adsbygoogle block"
      style="display: block"
      :data-ad-client="payload.client"
      :data-ad-slot="payload.slotId"
      data-ad-format="auto"
      data-full-width-responsive="true"
    />
    <p
      v-if="!payload.client"
      class="text-xs text-muted-foreground"
    >
      {{ t('public.ad.adsenseNotConfigured') }}
    </p>
  </div>
</template>

<script setup lang="ts">
import type { AdPayload } from '../types/advertising'

const props = defineProps<{
  payload: AdPayload
}>()

const { t } = useI18n()

/* push the adsbygoogle request once mounted (client only) */
onMounted(() => {
  if (!props.payload.client) return
  try {
    const w = window as unknown as { adsbygoogle?: unknown[] }
    w.adsbygoogle = w.adsbygoogle ?? []
    w.adsbygoogle.push({})
  } catch {
    // adsense script not loaded (or blocked) — render empty
  }
})
</script>
