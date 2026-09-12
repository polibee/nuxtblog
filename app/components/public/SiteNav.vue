<script setup lang="ts">
import type { PublicNavigationItem } from '#shared/schemas/navigation'

defineProps<{
  items: PublicNavigationItem[]
  orientation?: 'horizontal' | 'vertical'
}>()
</script>

<template>
  <ul :class="orientation === 'vertical' ? 'space-y-1' : 'flex items-center gap-4'">
    <li
      v-for="item in items"
      :key="item.url"
      class="group relative"
    >
      <NuxtLink
        :to="item.url"
        class="text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        {{ item.label }}
      </NuxtLink>
      <ul
        v-if="item.children.length"
        class="mt-1 hidden space-y-1 rounded-lg border bg-background p-2 shadow-md group-hover:block absolute left-0 top-full z-50 min-w-32"
      >
        <li
          v-for="child in item.children"
          :key="child.url"
        >
          <NuxtLink
            :to="child.url"
            class="block whitespace-nowrap text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            {{ child.label }}
          </NuxtLink>
        </li>
      </ul>
    </li>
  </ul>
</template>
