<template>
  <div class="flex min-h-screen flex-col bg-background text-foreground">
    <SiteHeader
      :site-name="siteName"
      :items="headerItems"
    >
      <LanguageSwitcher class="ml-3" />
      <UserMenu />
    </SiteHeader>

    <main class="mx-auto w-full max-w-7xl flex-1 px-4 py-8">
      <!-- two columns: fluid content + fixed-width sidebar that hugs it -->
      <div class="flex flex-col gap-8 lg:flex-row">
        <div class="min-w-0 flex-1">
          <slot />
        </div>
        <aside class="shrink-0 lg:w-80">
          <PublicSidebarCards />
        </aside>
      </div>
    </main>

    <SiteFooter
      :site-name="siteName"
      :items="footerItems"
    />
  </div>
</template>

<script setup lang="ts">
import PublicSidebarCards from '~/components/public/SidebarCards.vue'
import SiteHeader from '~/components/public/SiteHeader.vue'
import SiteFooter from '~/components/public/SiteFooter.vue'
import LanguageSwitcher from '~/components/public/LanguageSwitcher.vue'
import type { PublicNavigationItem } from '#shared/schemas/navigation'

const { localeCode } = useLocale()
const { siteName } = useSiteSettings()
const route = useRoute()

const { data: headerData, refresh: refreshHeader } = useFetch<{ location: string, items: PublicNavigationItem[] }>(
  '/api/public/navigation',
  {
    key: computed(() => `navigation-header-${localeCode.value}`),
    query: computed(() => ({ location: 'header', locale: localeCode.value })),
    lazy: true
  }
)
const { data: footerData, refresh: refreshFooter } = useFetch<{ location: string, items: PublicNavigationItem[] }>(
  '/api/public/navigation',
  {
    key: computed(() => `navigation-footer-${localeCode.value}`),
    query: computed(() => ({ location: 'footer', locale: localeCode.value })),
    lazy: true
  }
)

const headerItems = computed(() => headerData.value?.items ?? [])
const footerItems = computed(() => footerData.value?.items ?? [])

// Admin navigation edits invalidate server cache, but a kept-alive public
// layout can still hold the old useFetch payload. Refresh when the visitor
// returns to the tab so deleted menu items disappear without a hard reload.
function refreshNavigation(): void {
  void Promise.all([refreshHeader(), refreshFooter()])
}

function onNavigationStorage(event: StorageEvent): void {
  if (event.key === 'public-navigation-updated') refreshNavigation()
}

onMounted(() => window.addEventListener('focus', refreshNavigation))
onMounted(() => window.addEventListener('storage', onNavigationStorage))
onUnmounted(() => {
  window.removeEventListener('focus', refreshNavigation)
  window.removeEventListener('storage', onNavigationStorage)
})
watch(() => route.fullPath, refreshNavigation)

useHead({
  htmlAttrs: { lang: () => localeCode.value }
})
</script>
