<script setup lang="ts">
import { useI18n } from '~/admin/i18n'
import { resolveAdminDisplayLabel } from '~/admin/i18n/display-label'

/* C2 §36-37 context inspector: what the AI currently "knows" and can
   access — scope, depth, tools, attached entities, ~context tokens. */

interface ContextItem { type: string, id: number, title: string }

const props = defineProps<{
  scope: string
  depth: string
  attached: ContextItem[]
  contextTokens: number | null
}>()

const { t } = useI18n()

const tokenLabel = computed(() => {
  if (props.contextTokens === null) return '—'
  const k = props.contextTokens / 1000
  return `~${k >= 1 ? `${k.toFixed(1)}K` : Math.round(props.contextTokens)}`
})

function typeLabel(type: string): string {
  return resolveAdminDisplayLabel(t, 'aiSource', type)
}
</script>

<template>
  <div class="space-y-4 text-sm">
    <div>
      <p class="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {{ t('res.aichat.inspectorScope') }}
      </p>
      <p class="mt-0.5">
        {{ resolveAdminDisplayLabel(t, 'aiScope', scope) }}
      </p>
    </div>
    <div>
      <p class="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {{ t('res.aichat.inspectorDepth') }}
      </p>
      <p class="mt-0.5">
        {{ resolveAdminDisplayLabel(t, 'aiDepth', depth) }}
      </p>
    </div>
    <div>
      <p class="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {{ t('res.aichat.inspectorTools') }}
      </p>
      <p class="mt-0.5">
        {{ t('res.aichat.inspectorToolsValue') }}
      </p>
    </div>
    <div>
      <p class="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {{ t('res.aichat.inspectorContext') }}
      </p>
      <p
        v-if="attached.length === 0"
        class="mt-0.5 text-muted-foreground"
      >
        {{ t('res.aichat.inspectorNoContext') }}
      </p>
      <ul
        v-else
        class="mt-0.5 space-y-0.5"
      >
        <li
          v-for="item in attached"
          :key="`${item.type}-${item.id}`"
          class="truncate"
        >
          <span class="text-xs text-muted-foreground">{{ typeLabel(item.type) }} · </span>{{ item.title }}
        </li>
      </ul>
    </div>
    <div>
      <p class="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {{ t('res.aichat.inspectorTokens') }}
      </p>
      <p class="mt-0.5 font-mono text-xs">
        {{ tokenLabel }}
      </p>
      <p
        v-if="contextTokens !== null && contextTokens > 12000"
        class="mt-1 text-[10px] text-warning"
      >
        {{ t('res.aichat.largeContext') }}
      </p>
    </div>
  </div>
</template>
