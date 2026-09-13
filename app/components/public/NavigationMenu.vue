<script setup lang="ts">
import type { PublicNavigationItem } from '#shared/schemas/navigation'

/* Recursive navigation menu rendering the public DTO (spec §12).
   Output is SSR-safe and locale-resolved server-side. */

defineProps<{
  items: PublicNavigationItem[]
  orientation?: 'horizontal' | 'vertical'
  depth?: number
}>()

const { publicPath } = useLocale()

function linkPath(url: string): string {
  return url.startsWith('/') && !url.startsWith('//') ? publicPath(url) : url
}
</script>

<template>
  <ul
    :class="depth && depth > 0
      ? 'space-y-1'
      : orientation === 'vertical'
        ? 'space-y-2'
        : 'flex items-center gap-4'"
    class="list-none"
  >
    <li
      v-for="item in items"
      :key="`${item.url}-${item.label}`"
      class="group relative"
    >
      <span
        v-if="item.url === '#'"
        class="text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        {{ item.label }}
      </span>
      <NuxtLink
        v-else
        :to="linkPath(item.url)"
        :title="item.titleAttribute ?? undefined"
        :rel="item.rel ?? undefined"
        :target="item.url.startsWith('http') ? '_blank' : undefined"
        class="text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        {{ item.label }}
      </NuxtLink>
      <NavigationMenu
        v-if="item.children.length"
        :items="item.children"
        orientation="vertical"
        :depth="(depth ?? 0) + 1"
        class="absolute left-0 top-full z-50 hidden min-w-36 rounded-lg border bg-background p-2 shadow-md group-hover:block"
      />
    </li>
  </ul>
</template>
