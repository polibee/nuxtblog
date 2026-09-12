<script setup lang="ts">
/* v1 language switcher: stores the preferred content locale; full
   per-content URL mapping arrives with multi-language activation (P20). */

const { localeCode } = useLocale()
const locales = ref<Array<{ code: string, nativeName: string }>>([])

onMounted(async () => {
  try {
    const res = await $fetch<{ locales: Array<{ code: string, nativeName: string, enabled: boolean, contentEnabled: boolean }> }>(
      '/api/public/locales'
    )
    locales.value = res.locales.filter(l => l.enabled && l.contentEnabled)
  } catch {
    locales.value = []
  }
})

function switchTo(code: string): void {
  if (code === localeCode.value) return
  const cookie = useCookie<string>('blog_locale', { maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' })
  cookie.value = code
  window.location.reload()
}
</script>

<template>
  <div
    v-if="locales.length > 1"
    class="flex items-center gap-1 text-xs"
  >
    <button
      v-for="locale in locales"
      :key="locale.code"
      type="button"
      class="rounded px-1.5 py-0.5 transition-colors"
      :class="locale.code === localeCode ? 'bg-accent text-foreground' : 'text-muted-foreground hover:text-foreground'"
      @click="switchTo(locale.code)"
    >
      {{ locale.code }}
    </button>
  </div>
</template>
