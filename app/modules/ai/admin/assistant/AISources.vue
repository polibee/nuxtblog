<script setup lang="ts">
import { useI18n } from '~/admin/i18n'
import { resolveAdminDisplayLabel } from '~/admin/i18n/display-label'
import { ChevronDownIcon } from 'lucide-vue-next'

/* C1/§22-23 sources: collapsible reference list, internal links open in
   the admin (AIReference semantics without external hrefs). */

interface Reference {
  type: string
  id: number
  title: string
}

defineProps<{ references: Reference[] }>()

const { t } = useI18n()

function hrefFor(ref: Reference): string {
  if (ref.type === 'post') return `/admin/posts/${ref.id}/edit`
  if (ref.type === 'page') return `/admin/pages/${ref.id}/edit`
  if (ref.type === 'product') return `/admin/store/products/${ref.id}/edit`
  return '#'
}

function typeLabel(type: string): string {
  return resolveAdminDisplayLabel(t, 'aiSource', type)
}
</script>

<template>
  <details
    v-if="references.length > 0"
    class="group"
  >
    <summary class="flex w-fit cursor-pointer list-none items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
      {{ t('res.aichat.references') }} ({{ references.length }})
      <ChevronDownIcon class="h-3 w-3 transition-transform group-open:rotate-180" />
    </summary>
    <div class="mt-1.5 flex flex-wrap gap-1.5">
      <NuxtLink
        v-for="ref in references"
        :key="`${ref.type}-${ref.id}`"
        :to="hrefFor(ref)"
        class="rounded-full border px-2 py-0.5 text-xs text-primary hover:bg-accent"
      >
        <span class="text-muted-foreground">{{ typeLabel(ref.type) }} · </span>{{ ref.title }}
      </NuxtLink>
    </div>
  </details>
</template>
