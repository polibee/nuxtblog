<template>
  <div class="flex min-h-screen flex-col bg-background text-foreground">
    <SiteHeader
      :site-name="siteName"
      :items="headerItems"
    >
      <LanguageSwitcher class="ml-3" />
      <NuxtLink
        to="/admin"
        class="ml-4 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        {{ t('public.nav.admin') }}
      </NuxtLink>
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
    >
      <LanguageSwitcher />
    </SiteFooter>
  </div>
</template>

<script setup lang="ts">
import PublicSidebarCards from '~/components/public/SidebarCards.vue'
import SiteHeader from '~/components/public/SiteHeader.vue'
import SiteFooter from '~/components/public/SiteFooter.vue'
import LanguageSwitcher from '~/components/public/LanguageSwitcher.vue'
import type { PublicNavigationItem } from '#shared/schemas/navigation'

const { t } = useI18n()
const { localeCode } = useLocale()
const { siteName } = useSiteSettings()

const { data: headerData } = useFetch<{ location: string, items: PublicNavigationItem[] }>(
  '/api/public/navigation',
  { key: `navigation-header-${localeCode.value}`, query: { location: 'header', locale: localeCode.value }, lazy: true }
)
const { data: footerData } = useFetch<{ location: string, items: PublicNavigationItem[] }>(
  '/api/public/navigation',
  { key: `navigation-footer-${localeCode.value}`, query: { location: 'footer', locale: localeCode.value }, lazy: true }
)

const headerItems = computed(() => headerData.value?.items ?? [])
const footerItems = computed(() => footerData.value?.items ?? [])

useHead({
  htmlAttrs: { lang: () => localeCode.value }
})
</script>
