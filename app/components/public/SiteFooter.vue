<script setup lang="ts">
import type { PublicNavigationItem } from '#shared/schemas/navigation'

defineProps<{
  siteName: string
  items: PublicNavigationItem[]
}>()
</script>

<template>
  <footer class="border-t py-6">
    <div class="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 text-sm text-muted-foreground">
      <span>© {{ new Date().getFullYear() }} {{ siteName }}</span>
      <NavigationMenu
        :items="items"
        orientation="vertical"
      />
      <slot />
    </div>
  </footer>
</template>
