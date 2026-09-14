<script setup lang="ts">
import type { PublicNavigationItem } from '#shared/schemas/navigation'

defineProps<{
  siteName: string
  items: PublicNavigationItem[]
}>()

const { publicPath } = useLocale()
const { t } = useI18n()

function linkPath(url: string): string {
  return url.startsWith('/') && !url.startsWith('//') ? publicPath(url) : url
}
</script>

<template>
  <footer
    class="border-t bg-muted/20"
    :aria-label="t('common.navigation.footer')"
  >
    <div class="mx-auto max-w-7xl px-4 py-10">
      <div class="grid grid-cols-[repeat(auto-fit,minmax(min(100%,12rem),1fr))] gap-x-10 gap-y-8 md:gap-x-14 md:gap-y-10">
        <section
          v-for="item in items"
          :key="`${item.url}-${item.label}`"
          class="min-w-0"
        >
          <template v-if="item.url === '#'">
            <h2 class="text-sm font-semibold text-foreground">{{ item.label }}</h2>
            <ul v-if="item.children.length" class="mt-3 space-y-2">
              <li v-for="child in item.children" :key="`${child.url}-${child.label}`">
                <NuxtLink
                  :to="linkPath(child.url)"
                  :target="child.url.startsWith('http') ? '_blank' : undefined"
                  :rel="child.rel ?? undefined"
                  class="text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  {{ child.label }}
                </NuxtLink>
              </li>
            </ul>
          </template>
          <NuxtLink
            v-else
            :to="linkPath(item.url)"
            :target="item.url.startsWith('http') ? '_blank' : undefined"
            :rel="item.rel ?? undefined"
            class="text-sm font-semibold text-foreground hover:underline"
          >
            {{ item.label }}
          </NuxtLink>
        </section>
      </div>
      <div class="mt-10 flex flex-wrap items-center justify-between gap-4 border-t pt-5 text-sm text-muted-foreground">
        <span>© {{ new Date().getFullYear() }} {{ siteName }}</span>
        <slot />
      </div>
    </div>
  </footer>
</template>
