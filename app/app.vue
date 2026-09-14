<script setup lang="ts">
const ui = useUiStore()
const { siteName } = useSiteSettings()
const { data: integrations } = await useFetch<{
  analyticsEnabled: boolean
  analyticsHeadCode: string
  webmaster: { google: string, bing: string, baidu: string }
  adVerificationCode: string
}>('/api/public/site-integrations', { key: 'site-integrations', lazy: true })

const verificationMeta = computed(() => [
  integrations.value?.webmaster.google ? { name: 'google-site-verification', content: integrations.value.webmaster.google } : null,
  integrations.value?.webmaster.bing ? { name: 'msvalidate.01', content: integrations.value.webmaster.bing } : null,
  integrations.value?.webmaster.baidu ? { name: 'baidu-site-verification', content: integrations.value.webmaster.baidu } : null
].filter((item): item is { name: string, content: string } => Boolean(item)))

const integrationScripts = computed(() => {
  if (!integrations.value) return []
  const scripts: Array<{ innerHTML: string }> = []
  if (integrations.value.analyticsEnabled && integrations.value.analyticsHeadCode) scripts.push({ innerHTML: integrations.value.analyticsHeadCode })
  if (integrations.value.adVerificationCode) scripts.push({ innerHTML: integrations.value.adVerificationCode })
  return scripts
})

useHead({
  htmlAttrs: {
    class: () => (ui.theme === 'dark' ? 'dark' : '')
  },
  titleTemplate: title => (title ? `${title} · ${siteName.value}` : siteName.value),
  meta: verificationMeta,
  script: integrationScripts
})
</script>

<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>
