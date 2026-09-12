<script setup lang="ts">
import { useI18n } from '~/admin/i18n'
import { CircleCheckIcon, CircleDotIcon, ZapIcon } from 'lucide-vue-next'
import type { ToolActivityItem } from './types'

/* C1/§24-25 tool activity: friendly names by default; the raw tool +
   duration stay collapsed for developers. */

const props = defineProps<{ items: ToolActivityItem[] }>()

const { t } = useI18n()

function toolLabel(name: string): string {
  return t(`res.aichat.tool_${name.replace(/\./g, '_')}`)
}

function statusLabel(item: ToolActivityItem): string {
  if (item.status === 'error') return t('res.aichat.toolError')
  if (item.status === 'cache_hit') return t('res.aichat.toolCacheHit')
  return t('res.aichat.toolDone')
}

const hasDetails = computed(() => props.items.some(i => i.durationMs > 0))
</script>

<template>
  <div
    v-if="items.length > 0"
    class="space-y-1"
  >
    <div
      v-for="(item, i) in items"
      :key="`${item.tool}-${i}`"
      class="flex items-center gap-2 text-xs text-muted-foreground"
    >
      <CircleCheckIcon
        v-if="item.status !== 'error'"
        class="h-3.5 w-3.5 text-primary"
      />
      <CircleDotIcon
        v-else
        class="h-3.5 w-3.5 text-destructive"
      />
      <ZapIcon
        v-if="item.status === 'cache_hit'"
        class="h-3 w-3"
      />
      <span>{{ toolLabel(item.tool) }}</span>
      <span>· {{ statusLabel(item) }}</span>
    </div>
    <details v-if="hasDetails">
      <summary class="cursor-pointer text-[10px] text-muted-foreground/70">
        {{ t('res.aichat.toolDetails') }}
      </summary>
      <pre class="mt-1 overflow-x-auto rounded bg-muted p-2 text-[10px]">{{ items }}</pre>
    </details>
  </div>
</template>
