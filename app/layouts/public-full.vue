<template>
  <div class="flex min-h-screen flex-col bg-background text-foreground">
    <SiteHeader
      :site-name="siteName"
      :items="headerItems"
    >
      <LanguageSwitcher class="ml-3" />
      <UserMenu />
    </SiteHeader>

    <!-- full-width layout: no sidebar; used by the store grid pages -->
    <main class="mx-auto w-full max-w-7xl flex-1 px-4 py-8">
      <slot />
    </main>

    <SiteFooter
      :site-name="siteName"
      :items="footerItems"
    />
  </div>
</template>

<script setup lang="ts">
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
