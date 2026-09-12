<script setup lang="ts">
import ThemeToggle from '~/components/public/ThemeToggle.vue'
import type { PublicNavigationItem } from '#shared/schemas/navigation'

defineProps<{
  siteName: string
  items: PublicNavigationItem[]
}>()

const { t } = useI18n()

const q = ref('')

function go(): void {
  const term = q.value.trim()
  if (!term) return
  navigateTo({ path: '/search', query: { q: term } })
}
</script>

<template>
  <header class="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
    <div class="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-4">
      <NuxtLink
        to="/"
        class="shrink-0 text-lg font-semibold tracking-tight"
      >
        {{ siteName }}
      </NuxtLink>
      <nav
        aria-label="Main navigation"
        class="flex items-center"
      >
        <NavigationMenu
          :items="items"
          orientation="horizontal"
        />
        <form
          class="relative ml-4 hidden md:block"
          role="search"
          @submit.prevent="go"
        >
          <input
            v-model="q"
            type="search"
            :placeholder="t('public.search.placeholder')"
            :aria-label="t('public.search.title')"
            class="h-9 w-28 rounded-md border bg-background pl-3 pr-8 text-sm transition-all focus:w-44 focus:outline-none focus:ring-1 focus:ring-primary"
          >
          <svg
            class="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
          >
            <circle
              cx="11"
              cy="11"
              r="7"
            />
            <path d="m20 20-3.5-3.5" />
          </svg>
        </form>
        <ThemeToggle class="ml-1.5" />
        <slot />
      </nav>
    </div>
  </header>
</template>
