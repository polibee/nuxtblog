<script setup lang="ts">
const ui = useUiStore()
const { siteName } = useSiteSettings()

useHead({
  htmlAttrs: {
    class: () => (ui.theme === 'dark' ? 'dark' : '')
  },
  titleTemplate: title => (title ? `${title} · ${siteName.value}` : siteName.value)
})
</script>

<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>
